import type { Loader } from "astro/loaders";
import { z } from "astro/zod";
import { printers } from "../content/printers";
import { resolveRelativeImageUrl } from "../utils/markdown";

const GITHUB_API = "https://api.github.com";
const GITHUB_RAW = "https://raw.githubusercontent.com";
const GITHUB_TOKEN = import.meta.env["GITHUB_TOKEN"];
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_VERSION = 6;
const CACHE_META_PREFIX = "mods-loader:";
const IMAGE_FILE_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

const ModEntrySchema = z.object({
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
});

export { ModEntrySchema };

const ReadmeShasSchema = z.record(z.string(), z.string());

const PrinterCacheStateSchema = z.object({
  source: z.string(),
  syncedAt: z.number(),
  readmeShas: ReadmeShasSchema,
  entryIds: z.array(z.string()),
});

const CachedReadmeSchema = z.object({
  readme: z.string().nullable(),
  readmeExtension: z.string().nullable(),
});

const ReadmeInfoSchema = z.object({
  path: z.string(),
  extension: z.string(),
  sha: z.string().optional(),
});

const ModDirectorySchema = z.object({
  author: z.string(),
  name: z.string(),
});

const ModsForPrinterSchema = z.object({
  mods: z.array(ModEntrySchema),
  readmeShas: ReadmeShasSchema,
});

type ModEntry = z.infer<typeof ModEntrySchema>;
type PrinterCacheState = z.infer<typeof PrinterCacheStateSchema>;
type CachedReadme = z.infer<typeof CachedReadmeSchema>;
type ReadmeInfo = z.infer<typeof ReadmeInfoSchema>;
type ModDirectory = z.infer<typeof ModDirectorySchema>;
type ModsForPrinter = z.infer<typeof ModsForPrinterSchema>;

function extractThumbnail(
  readme: string | null,
  rawBase: string,
  repositoryBase: string,
): string | null {
  if (!readme) return null;

  const match = readme.match(
    /!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))[^)]*\)|<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\3[^>]*>/i,
  );
  const href = match?.[1] ?? match?.[2] ?? match?.[4];
  if (!href) return null;

  const resolvedHref =
    href.startsWith("/") && !href.startsWith("//")
      ? resolveRelativeImageUrl(href.slice(1), repositoryBase)
      : resolveRelativeImageUrl(href, rawBase);

  return normalizeGitHubBlobImageUrl(resolvedHref);
}

function normalizeGitHubBlobImageUrl(href: string): string {
  try {
    const url = new URL(href);
    if (url.hostname !== "github.com") return href;

    const [owner, repository, blob, branch, ...path] = url.pathname
      .split("/")
      .filter(Boolean);
    if (
      blob !== "blob" ||
      !owner ||
      !repository ||
      !branch ||
      path.length === 0
    ) {
      return href;
    }

    url.hostname = "raw.githubusercontent.com";
    url.pathname = `/${[owner, repository, branch, ...path].join("/")}`;
    return url.href;
  } catch {
    return href;
  }
}

function extractFileThumbnail(
  tree: GitHubTree,
  dirPath: string,
  rawBase: string,
): string | null {
  const image = tree.tree.find(
    (entry) =>
      entry.type === "blob" &&
      entry.path.startsWith(`${dirPath}/`) &&
      IMAGE_FILE_EXTENSION.test(entry.path),
  );

  return image
    ? resolveRelativeImageUrl(image.path.slice(dirPath.length + 1), rawBase)
    : null;
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
    headers: {
      Accept: "application/vnd.github+json",
      ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
    },
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

function parseCacheState(value: string | undefined): PrinterCacheState | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    return PrinterCacheStateSchema.parse(parsed);
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
    if (
      data["printerId"] !== printerId ||
      typeof data["githubUrl"] !== "string"
    ) {
      continue;
    }

    cachedReadmes.set(
      data["githubUrl"],
      CachedReadmeSchema.parse({
        readme: typeof data["readme"] === "string" ? data["readme"] : null,
        readmeExtension:
          typeof data["readmeExtension"] === "string"
            ? data["readmeExtension"]
            : null,
      }),
    );
  }

  return cachedReadmes;
}

async function getModsForPrinter(
  repo: string,
  path: string,
  branch: string,
  previousReadmes: Map<string, CachedReadme>,
  previousReadmeShas: Record<string, string>,
): Promise<ModsForPrinter> {
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

  const modDirs = new Map<string, ModDirectory>();
  for (const entry of entries) {
    const rel = entry.path.slice(prefix.length + 1);
    const parts = rel.split("/");
    if (depth === 2 && parts.length === 2) {
      modDirs.set(
        entry.path,
        ModDirectorySchema.parse({
          author: parts[0] || "",
          name: parts[1] || "",
        }),
      );
    } else if (depth === 1 && parts.length === 1) {
      modDirs.set(
        entry.path,
        ModDirectorySchema.parse({
          author: "",
          name: parts[0] || "",
        }),
      );
    }
  }

  const readmeFiles = tree.tree.filter((e) => {
    if (e.type !== "blob" || !e.path.startsWith(prefix + "/")) return false;

    const relativePath = e.path.slice(prefix.length + 1).split("/");
    const filename = relativePath.at(-1) || "";
    return (
      relativePath.length === depth + 1 &&
      filename.split(".")[0]?.toLowerCase() === "readme"
    );
  });

  const readmeMap = new Map<string, ReadmeInfo>();
  for (const rf of readmeFiles) {
    const rel = rf.path.slice(prefix.length + 1).split("/");
    const parentParts = rel.slice(0, depth);
    const parentPath = prefix + "/" + parentParts.join("/");
    const filename = rel.at(-1)?.toLowerCase() || "";
    const extension = filename.includes(".")
      ? filename.split(".").pop() || "md"
      : "md";
    readmeMap.set(
      parentPath,
      ReadmeInfoSchema.parse({
        path: rf.path,
        extension,
        sha: rf.sha,
      }),
    );
  }

  const readmeShas: Record<string, string> = {};
  for (const readmeFile of readmeFiles) {
    if (readmeFile.sha) {
      readmeShas[`${owner}/${name}/${branch}/${readmeFile.path}`] =
        readmeFile.sha;
    }
  }

  const mods: ModEntry[] = [];

  for (const [dirPath, { author, name: modName }] of modDirs) {
    const readmeInfo = readmeMap.get(dirPath);
    let readme: string | null = null;
    let readmeExtension: string | null = null;
    const githubUrl = `https://github.com/${owner}/${name}/tree/${branch}/${dirPath}`;

    if (readmeInfo) {
      readmeExtension = readmeInfo.extension;
      const cachedReadme = previousReadmes.get(githubUrl);
      const readmeShaKey = `${owner}/${name}/${branch}/${readmeInfo.path}`;
      if (
        cachedReadme &&
        readmeInfo.sha &&
        previousReadmeShas[readmeShaKey] === readmeInfo.sha
      ) {
        readme = cachedReadme.readme;
      } else {
        readme = await fetchRaw(
          `${GITHUB_RAW}/${owner}/${name}/${branch}/${readmeInfo.path}`,
        );
      }
    }

    const rawBase = `${GITHUB_RAW}/${owner}/${name}/${branch}/${dirPath}`;
    const repositoryBase = `${GITHUB_RAW}/${owner}/${name}/${branch}`;
    const thumbnail =
      extractThumbnail(readme, rawBase, repositoryBase) ??
      extractFileThumbnail(tree, dirPath, rawBase);

    mods.push({
      id: `${owner}-${name}-${dirPath}`.replace(/[/.]/g, "-").toLowerCase(),
      printerId: "",
      name: formatName(modName),
      author: author ? formatName(author) : "",
      description: extractDescription(readme),
      thumbnail,
      path: dirPath,
      readme,
      readmeExtension,
      githubUrl,
    });
  }

  return ModsForPrinterSchema.parse({ mods, readmeShas });
}

export function modsLoader(): Loader {
  return {
    name: "mods-loader",
    load: async ({ store, meta, parseData, logger }) => {
      for (const printer of printers) {
        const { id: printerId, mods } = printer;
        const metaKey = `${CACHE_META_PREFIX}${printerId}`;
        if (mods.length === 0) {
          meta.delete(metaKey);
          continue;
        }

        const branch = printer.github.branch;
        const source = JSON.stringify({
          version: CACHE_VERSION,
          mods: mods.map(({ repo, path }) => ({ repo, path, branch })),
        });
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

        logger.info(
          `Fetching mods for ${printerId} from ${mods.map(({ repo }) => repo).join(", ")}`,
        );

        try {
          const cachedReadmes = getCachedReadmes(store, printerId);
          const sourceResults: ModsForPrinter[] = [];
          for (const { repo, path } of mods) {
            sourceResults.push(
              await getModsForPrinter(
                repo,
                path,
                branch,
                cachedReadmes,
                matchingCache ? cacheState.readmeShas : {},
              ),
            );
          }

          const discoveredMods = sourceResults.flatMap((result) => result.mods);
          const readmeShas = Object.assign(
            {},
            ...sourceResults.map((result) => result.readmeShas),
          );

          const entries = await Promise.all(
            discoveredMods.map(async (mod) => {
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

          logger.info(`Found ${discoveredMods.length} mods for ${printerId}`);
        } catch (error) {
          if (!matchingCache || !hasCachedEntries) throw error;

          logger.warn(
            `Could not refresh mods for ${printerId}; using cached data: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      const configuredPrinterIds = new Set(
        printers
          .filter((printer) => printer.mods.length > 0)
          .map((printer) => printer.id),
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
