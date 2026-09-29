import type { Loader } from "astro/loaders";
import { z } from "astro/zod";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";

const GITHUB_API = "https://api.github.com";
const GITHUB_RAW = "https://raw.githubusercontent.com";
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_META_PREFIX = "mods-loader:";

interface ModEntry {
  id: string;
  printerId: string;
  name: string;
  author: string;
  description: string | null;
  thumbnail: string | null;
  path: string;
  readme: string | null;
  readmeExtension: string | null;
  githubUrl: string;
}

interface PrinterCacheState {
  source: string;
  syncedAt: number;
  readmeShas: Record<string, string>;
  entryIds: string[];
}

interface CachedReadme {
  readme: string | null;
  readmeExtension: string | null;
}

interface ReadmeInfo {
  path: string;
  extension: string;
  sha: string | undefined;
}

function extractThumbnail(
  readme: string | null,
  rawBase: string,
): string | null {
  if (!readme) return null;

  const match = readme.match(/!\[.*?\]\(([^)]+)\)/);
  if (!match || !match[1]) return null;

  let href = match[1];
  if (!/^https?:\/\//.test(href)) {
    href = `${rawBase}/${href.replace(/^\.\//, "")}`;
  }
  return href;
}

function extractDescription(readme: string | null): string | null {
  if (!readme) {
    return null;
  }

  const firstParagraph = readme.split(/\n\n+/).at(0);
  if (!firstParagraph) {
    return null;
  }

  const plain = firstParagraph
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/!\[.*?\]\(.+?\)/g, "")
    .replace(/<[^>]+>/g, "")
    // replace all &#xABCD; :
    .replace(/&#x[a-f0-9]+;/gi, "")
    .trim();

  return plain || null;
}

function formatName(dirName: string): string {
  return dirName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseGlobDepth(glob: string): number {
  const segments = glob.replace(/\/$/, "").split("/");
  return segments.filter((s) => s === "*" || s.includes("*")).length;
}

const GitHubTreeSchema = z.object({
  tree: z.array(
    z.object({
      path: z.string(),
      type: z.string(),
      size: z.number().optional(),
      sha: z.string().optional(),
    }),
  ),
  truncated: z.boolean().optional(),
});

type GitHubTree = z.infer<typeof GitHubTreeSchema>;

async function fetchGitHubTree(url: string): Promise<GitHubTree> {
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub HTTP ${res.status}: ${url}`, {
      cause: { text },
    });
  }

  const payload: unknown = await res.json();
  return GitHubTreeSchema.parse(payload);
}

async function fetchRaw(url: string): Promise<string | null> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub HTTP ${res.status}: ${url}`, {
      cause: { text },
    });
  }

  return await res.text();
}

const PrinterConfigSchema = z.object({
  id: z.string(),
  github: z.object({
    url: z.string(),
    branch: z.string(),
    readme: z.string(),
  }),
  mods: z
    .object({
      repo: z.string(),
      path: z.string(),
    })
    .optional(),
});

type PrinterConfig = z.infer<typeof PrinterConfigSchema>;

function parseCacheState(value: string | undefined): PrinterCacheState | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return null;

    const state = parsed as Partial<PrinterCacheState>;
    if (
      typeof state.source !== "string" ||
      typeof state.syncedAt !== "number" ||
      !Array.isArray(state.entryIds) ||
      !state.entryIds.every((id) => typeof id === "string") ||
      typeof state.readmeShas !== "object" ||
      state.readmeShas === null ||
      !Object.values(state.readmeShas).every((sha) => typeof sha === "string")
    ) {
      return null;
    }

    return state as PrinterCacheState;
  } catch {
    return null;
  }
}

function getCachedReadmes(
  store: Parameters<Loader["load"]>[0]["store"],
  printerId: string,
): Map<string, CachedReadme> {
  const cachedReadmes = new Map<string, CachedReadme>();

  for (const entry of store.values()) {
    const { data } = entry;
    if (data["printerId"] !== printerId || typeof data["path"] !== "string") {
      continue;
    }

    cachedReadmes.set(data["path"], {
      readme: typeof data["readme"] === "string" ? data["readme"] : null,
      readmeExtension:
        typeof data["readmeExtension"] === "string"
          ? data["readmeExtension"]
          : null,
    });
  }

  return cachedReadmes;
}

function loadPrinterConfigs(baseDir: string): PrinterConfig[] {
  const filePath = resolve(baseDir, "src/content/printers.yaml");
  const content = readFileSync(filePath, "utf-8");
  return z.array(PrinterConfigSchema).parse(YAML.parse(content));
}

async function getModsForPrinter(
  repo: string,
  path: string,
  branch: string,
  previousReadmes: Map<string, CachedReadme>,
  previousReadmeShas: Record<string, string>,
): Promise<{ mods: ModEntry[]; readmeShas: Record<string, string> }> {
  const [owner, name] = repo.split("/");
  const depth = parseGlobDepth(path);
  const prefix = path.replace(/\*+\/?/g, "").replace(/\/$/, "");

  const tree = await fetchGitHubTree(
    `${GITHUB_API}/repos/${owner}/${name}/git/trees/${branch}?recursive=1`,
  );

  if (tree.truncated) {
    throw new Error(`GitHub tree truncated for ${repo}; keeping cached mods`);
  }

  const entries = tree.tree.filter(
    (e) => e.type === "tree" && e.path.startsWith(prefix + "/"),
  );

  const modDirs = new Map<string, { author: string; name: string }>();
  for (const entry of entries) {
    const rel = entry.path.slice(prefix.length + 1);
    const parts = rel.split("/");
    if (depth === 2 && parts.length === 2) {
      modDirs.set(entry.path, {
        author: parts[0] || "",
        name: parts[1] || "",
      });
    } else if (depth === 1 && parts.length === 1) {
      modDirs.set(entry.path, {
        author: "",
        name: parts[0] || "",
      });
    }
  }

  const readmeFiles = tree.tree.filter(
    (e) =>
      e.type === "blob" &&
      e.path.startsWith(prefix + "/") &&
      /^readme\.(md|txt|markdown)$/i.test(e.path.split("/").pop() || ""),
  );

  const readmeMap = new Map<string, ReadmeInfo>();
  for (const rf of readmeFiles) {
    const rel = rf.path.slice(prefix.length + 1);
    const parentParts = rel.split("/").slice(0, depth);
    const parentPath = prefix + "/" + parentParts.join("/");
    const ext = rf.path.split(".").pop() || "md";
    readmeMap.set(parentPath, {
      path: rf.path,
      extension: ext,
      sha: rf.sha,
    });
  }

  const readmeShas: Record<string, string> = {};
  for (const readmeFile of readmeFiles) {
    if (readmeFile.sha) readmeShas[readmeFile.path] = readmeFile.sha;
  }

  const mods: ModEntry[] = [];

  for (const [dirPath, { author, name: modName }] of modDirs) {
    const readmeInfo = readmeMap.get(dirPath);
    let readme: string | null = null;
    let readmeExtension: string | null = null;

    if (readmeInfo) {
      readmeExtension = readmeInfo.extension;
      const cachedReadme = previousReadmes.get(dirPath);
      if (
        cachedReadme &&
        readmeInfo.sha &&
        previousReadmeShas[readmeInfo.path] === readmeInfo.sha
      ) {
        readme = cachedReadme.readme;
      } else {
        readme = await fetchRaw(
          `${GITHUB_RAW}/${owner}/${name}/${branch}/${readmeInfo.path}`,
        );
      }
    }

    const rawBase = `${GITHUB_RAW}/${owner}/${name}/${branch}/${dirPath}`;

    mods.push({
      id: `${owner}-${name}-${dirPath}`.replace(/[/.]/g, "-").toLowerCase(),
      printerId: "",
      name: formatName(modName),
      author: author ? formatName(author) : "",
      description: extractDescription(readme),
      thumbnail: extractThumbnail(readme, rawBase),
      path: dirPath,
      readme,
      readmeExtension,
      githubUrl: `https://github.com/${owner}/${name}/tree/${branch}/${dirPath}`,
    });
  }

  return { mods, readmeShas };
}

export function modsLoader(): Loader {
  return {
    name: "mods-loader",
    load: async ({ store, meta, parseData, logger, config }) => {
      const baseDir = config.root.pathname || process.cwd();
      const printers = loadPrinterConfigs(baseDir);

      for (const printer of printers) {
        if (!printer.mods) continue;

        const { id: printerId, mods } = printer;
        const { repo, path } = mods;
        const branch = printer.github.branch;

        const source = JSON.stringify({ repo, path, branch });
        const metaKey = `${CACHE_META_PREFIX}${printerId}`;
        const cacheState = parseCacheState(meta.get(metaKey));
        const matchingCache = cacheState?.source === source;
        const cachedEntryIds = matchingCache ? cacheState.entryIds : [];
        const hasCachedEntries = cachedEntryIds.every((id) => store.has(id));
        const cacheAge = cacheState
          ? Date.now() - cacheState.syncedAt
          : Infinity;

        if (
          matchingCache &&
          hasCachedEntries &&
          cacheAge >= 0 &&
          cacheAge < CACHE_TTL_MS
        ) {
          logger.info(`Using cached mods for ${printerId}`);
          continue;
        }

        logger.info(`Fetching mods for ${printerId} from ${repo}`);

        try {
          const cachedReadmes = getCachedReadmes(store, printerId);
          const { mods, readmeShas } = await getModsForPrinter(
            repo,
            path,
            branch,
            cachedReadmes,
            matchingCache ? cacheState.readmeShas : {},
          );

          const entries = await Promise.all(
            mods.map(async (mod) => {
              const id = `${printerId}-${mod.id}`;
              const data = await parseData({
                id,
                data: {
                  ...mod,
                  printerId,
                  id,
                },
              });
              return { id, data };
            }),
          );

          const nextEntryIds = new Set(entries.map(({ id }) => id));
          for (const [id, entry] of store.entries()) {
            if (
              entry.data["printerId"] === printerId &&
              !nextEntryIds.has(id)
            ) {
              store.delete(id);
            }
          }

          for (const entry of entries) {
            store.set(entry);
          }

          meta.set(
            metaKey,
            JSON.stringify({
              source,
              syncedAt: Date.now(),
              readmeShas,
              entryIds: entries.map(({ id }) => id),
            } satisfies PrinterCacheState),
          );

          logger.info(`Found ${mods.length} mods for ${printerId}`);
        } catch (error) {
          if (!matchingCache || !hasCachedEntries) throw error;

          logger.warn(
            `Could not refresh mods for ${printerId}; using cached data: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      const configuredPrinterIds = new Set(
        printers.filter((printer) => printer.mods).map((printer) => printer.id),
      );
      for (const [id, entry] of store.entries()) {
        const printerId = entry.data["printerId"];
        if (
          typeof printerId === "string" &&
          !configuredPrinterIds.has(printerId)
        ) {
          store.delete(id);
        }
      }
    },
    schema: z.object({
      id: z.string(),
      printerId: z.string(),
      name: z.string(),
      author: z.string(),
      description: z.string().nullable(),
      thumbnail: z.string().nullable(),
      path: z.string(),
      readme: z.string().nullable(),
      readmeExtension: z.string().nullable(),
      githubUrl: z.string(),
    }),
  };
}
