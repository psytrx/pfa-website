// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd, env } from "node:process";
import YAML from "yaml";
import { loadEnv } from "vite";
import { z } from "astro/zod";

const mode = env["NODE_ENV"] ?? "development";
const { PUBLIC_SITE_URL } = loadEnv(mode, cwd(), "PUBLIC_");

if (!PUBLIC_SITE_URL) {
  throw new Error("PUBLIC_SITE_URL must be set");
}

const CATEGORIES = {
  "scratch-builds": "Scratch Builds",
  "v0-mods": "V0 Mods",
  "barely-bigger": "Barely Bigger Mini Printers",
};

const SidebarPrinterSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum(["scratch-builds", "v0-mods", "barely-bigger"]),
  mods: z
    .object({
      repo: z.string(),
      path: z.string(),
    })
    .optional(),
  documentation_pdf: z.string().optional(),
});

function generatePrinterSidebar() {
  const filePath = resolve("src/content/printers.yaml");
  const content = readFileSync(filePath, "utf-8");
  const printers = z.array(SidebarPrinterSchema).parse(YAML.parse(content));

  return Object.entries(CATEGORIES).map(([key, label]) => {
    const items = printers
      .filter((p) => p.category === key)
      .map((p) => {
        const link = `/printers/${p.id}/`;
        const sub = [{ label: p.title, link }];

        if (p.mods) {
          sub.push({
            label: `${p.title} Mods`,
            link: `/printers/${p.id}/mods/`,
          });
        }

        if (p.documentation_pdf) {
          sub.push({
            label: "Documentation",
            link: `/printers/${p.id}/documentation/`,
          });
        }

        return sub.length > 1
          ? { label: p.title, items: sub }
          : { label: p.title, link };
      });

    return { label, items };
  });
}

// https://astro.build/config
export default defineConfig({
  site: PUBLIC_SITE_URL,
  integrations: [
    starlight({
      title: "PrintersForAnts",
      favicon: "./src/assets/anthead-hex.png",
      logo: {
        src: "./src/assets/anthead-hex.png",
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/PrintersForAnts",
        },
      ],
      customCss: ["./src/styles/global.css"],
      sidebar: generatePrinterSidebar(),
      components: {
        Footer: "./src/components/CustomFooter.astro",
      },
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
