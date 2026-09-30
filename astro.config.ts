import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { cwd, env } from "node:process";
import { loadEnv } from "vite";
import { printers } from "./src/content/printers";

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

function generatePrinterSidebar() {
  return Object.entries(CATEGORIES).map(([key, label]) => {
    const items = printers
      .filter((p) => p.category === key)
      .map((p) => {
        const link = `/printers/${p.id}/`;
        const sub = [{ label: p.title, link }];

        if (p.mods.length > 0) {
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
        Footer: "./src/components/Footer.astro",
      },
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
