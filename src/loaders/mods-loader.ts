import type { Loader } from "astro/loaders";
import { z } from "astro/zod";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";

const GITHUB_API = "https://api.github.com";
const GITHUB_RAW = "https://raw.githubusercontent.com";

interface ModEntry {
  id: string;
  printerId: string;
  name: string;
  author: string;
  description: string | null;
  path: string;
  readme: string | null;
  readmeExtension: string | null;
  githubUrl: string;
}

function extractDescription(readme: string | null): string | null {
  if (!readme) return null;
  const firstParagraph = readme.split(/\n\n+/)[0];
  const plain = firstParagraph
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/!\[.*?\]\(.+?\)/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
  return plain || null;
}

function formatName(dirName: string): string {
  return dirName
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseGlobDepth(glob: string): number {
  const segments = glob.replace(/\/$/, "").split("/");
  return segments.filter((s) => s === "*" || s.includes("*")).length;
}

async function fetchJSON<T>(url: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${url}`);
  }
  return res.json();
}

async function fetchRaw(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function loadPrinterConfigs(baseDir: string): { id: string; mods: { repo: string; path: string; branch: string } }[] {
  const printersDir = resolve(baseDir, "src/content/printers");
  const files = readdirSync(printersDir).filter((f) => f.endsWith(".yaml"));
  const results: { id: string; mods: { repo: string; path: string; branch: string } }[] = [];

  for (const file of files) {
    const content = readFileSync(resolve(printersDir, file), "utf-8");
    const data = YAML.parse(content);
    if (data.mods) {
      results.push({
        id: file.replace(".yaml", ""),
        mods: { branch: "main", ...data.mods },
      });
    }
  }

  return results;
}

async function getModsForPrinter(
  repo: string,
  path: string,
  branch: string,
  token?: string,
): Promise<ModEntry[]> {
  const [owner, name] = repo.split("/");
  const depth = parseGlobDepth(path);
  const prefix = path.replace(/\*+\/?/g, "").replace(/\/$/, "");

  const tree = await fetchJSON<{
    tree: { path: string; type: string; size?: number }[];
    truncated?: boolean;
  }>(`${GITHUB_API}/repos/${owner}/${name}/git/trees/${branch}?recursive=1`, token);

  if (tree.truncated) {
    console.warn(`GitHub tree truncated for ${repo} — some mods may be missing`);
  }

  const entries = tree.tree.filter(
    (e) => e.type === "tree" && e.path.startsWith(prefix + "/"),
  );

  const modDirs = new Map<string, { author: string; name: string }>();
  for (const entry of entries) {
    const rel = entry.path.slice(prefix.length + 1);
    const parts = rel.split("/");
    if (depth === 2 && parts.length === 2) {
      modDirs.set(entry.path, { author: parts[0], name: parts[1] });
    } else if (depth === 1 && parts.length === 1) {
      modDirs.set(entry.path, { author: "", name: parts[0] });
    }
  }

  const readmeFiles = tree.tree.filter(
    (e) =>
      e.type === "blob" &&
      e.path.startsWith(prefix + "/") &&
      /^readme\.(md|txt|markdown)$/i.test(e.path.split("/").pop() || ""),
  );

  const readmeMap = new Map<string, { path: string; extension: string }>();
  for (const rf of readmeFiles) {
    const rel = rf.path.slice(prefix.length + 1);
    const parentParts = rel.split("/").slice(0, depth);
    const parentPath = prefix + "/" + parentParts.join("/");
    const ext = rf.path.split(".").pop() || "md";
    readmeMap.set(parentPath, { path: rf.path, extension: ext });
  }

  const mods: ModEntry[] = [];

  for (const [dirPath, { author, name: modName }] of modDirs) {
    const readmeInfo = readmeMap.get(dirPath);
    let readme: string | null = null;
    let readmeExtension: string | null = null;

    if (readmeInfo) {
      readmeExtension = readmeInfo.extension;
      readme = await fetchRaw(
        `${GITHUB_RAW}/${owner}/${name}/${branch}/${readmeInfo.path}`,
      );
    }

    mods.push({
      id: `${owner}-${name}-${dirPath}`.replace(/[/.]/g, "-").toLowerCase(),
      printerId: "",
      name: formatName(modName),
      author: author ? formatName(author) : "",
      description: extractDescription(readme),
      path: dirPath,
      readme,
      readmeExtension,
      githubUrl: `https://github.com/${owner}/${name}/tree/${branch}/${dirPath}`,
    });
  }

  return mods;
}

export function modsLoader(): Loader {
  return {
    name: "mods-loader",
    load: async ({ store, parseData, logger, config }) => {
      const token = process.env.GITHUB_TOKEN;
      const printers = loadPrinterConfigs(config.root.pathname || process.cwd());

      store.clear();

      for (const printer of printers) {
        const { repo, path, branch } = printer.mods;
        logger.info(`Fetching mods for ${printer.id} from ${repo}`);

        try {
          const mods = await getModsForPrinter(repo, path, branch, token);

          for (const mod of mods) {
            const id = `${printer.id}-${mod.id}`;
            const data = await parseData({
              id,
              data: {
                ...mod,
                printerId: printer.id,
                id,
              },
            });
            store.set({ id, data });
          }

          logger.info(`Found ${mods.length} mods for ${printer.id}`);
        } catch (err) {
          logger.warn(
            `Failed to fetch mods for ${printer.id}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    },
    schema: z.object({
      id: z.string(),
      printerId: z.string(),
      name: z.string(),
      author: z.string(),
      description: z.string().nullable(),
      path: z.string(),
      readme: z.string().nullable(),
      readmeExtension: z.string().nullable(),
      githubUrl: z.string(),
    }),
  };
}
