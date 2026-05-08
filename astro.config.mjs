// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";

const CATEGORIES = {
  "scratch-builds": "Scratch Builds",
  "v0-mods": "V0 Mods",
  "barely-bigger": "Barely Bigger Mini Printers",
};

function generatePrinterSidebar() {
  const printersDir = resolve("src/content/printers");
  const files = readdirSync(printersDir).filter((f) => f.endsWith(".yaml"));

  const printers = files.map((f) => {
    const content = readFileSync(resolve(printersDir, f), "utf-8");
    const data = YAML.parse(content);
    return { id: f.replace(".yaml", ""), ...data };
  });

  printers.sort((a, b) => a.order - b.order);

  return Object.entries(CATEGORIES).map(([key, label]) => {
    const items = printers
      .filter((p) => p.category === key)
      .map((p) => {
        const link = `/printers/${p.id}/`;
        if (p.mods) {
          return {
            label: p.title,
            items: [
              { label: p.title, link },
              { label: `${p.title} Mods`, link: `/printers/${p.id}/mods/` },
            ],
          };
        }
        return { label: p.title, link };
      });

    return { label, items };
  });
}

// https://astro.build/config
export default defineConfig({
  site: "https://replace-me.please.biz",
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
