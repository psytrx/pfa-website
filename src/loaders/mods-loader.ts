import type { Loader } from "astro/loaders";
import { z } from "astro/zod";
import { getSecret } from "astro:env/server";
import { readFileSync } from "node:fs";
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

async function fetchJSON<T>(url: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub HTTP ${res.status}: ${url}`, {
      cause: { text },
    });
  }

  return res.json();
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
  }),
  mods: z
    .object({
      repo: z.string(),
      path: z.string(),
    })
    .optional(),
});

type PrinterConfig = z.infer<typeof PrinterConfigSchema>;

function hasMods(
  p: PrinterConfig,
): p is PrinterConfig & { mods: NonNullable<PrinterConfig["mods"]> } {
  return p.mods != null;
}

function loadPrinterConfigs(baseDir: string) {
  const filePath = resolve(baseDir, "src/content/printers.yaml");
  const content = readFileSync(filePath, "utf-8");
  const parsed = YAML.parse(content);
  const result = z.array(PrinterConfigSchema).safeParse(parsed);

  if (!result.success) {
    throw new Error(`Invalid printer config: ${result.error.message}`);
  }

  return result.data.filter(hasMods).map((p) => ({
    id: p.id,
    branch: p.github.branch,
    mods: p.mods,
  }));
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
  }>(
    `${GITHUB_API}/repos/${owner}/${name}/git/trees/${branch}?recursive=1`,
    token,
  );

  if (tree.truncated) {
    console.warn(
      `GitHub tree truncated for ${repo} — some mods may be missing`,
    );
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
      const token = getSecret("GITHUB_TOKEN");
      const printers = loadPrinterConfigs(
        config.root.pathname || process.cwd(),
      );

      store.clear();

      for (const printer of printers) {
        const { repo, path } = printer.mods;
        const branch = printer.branch;
        logger.info(`Fetching mods for ${printer.id} from ${repo}`);

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
