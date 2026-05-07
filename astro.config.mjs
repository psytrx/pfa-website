// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
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
      sidebar: [
        {
          label: "Scratch Builds",
          items: [
            {
              label: "Micron",
              items: [
                { slug: "printers/micron" },
                { label: "Micron Mods", link: "/printers/micron/mods/" },
              ],
            },
            "printers/salad-fork",
          ],
        },
        {
          label: "V0 Mods",
          items: [
            "printers/dueling-zero",
            "printers/double-dragon",
            "printers/crucible",
            "printers/f-zero",
            {
              label: "Tri-Zero",
              items: [
                { slug: "printers/tri-zero" },
                { label: "Tri-Zero Mods", link: "/printers/tri-zero/mods/" },
              ],
            },
            {
              label: "Pandora's Box",
              items: [
                { slug: "printers/pandoras-box" },
                { label: "Pandora's Box Mods", link: "/printers/pandoras-box/mods/" },
              ],
            },
            {
              label: "Hex-Zero",
              items: [
                { slug: "printers/hex-zero" },
                { label: "Hex-Zero Mods", link: "/printers/hex-zero/mods/" },
              ],
            },
          ],
        },
        {
          label: "Barely Bigger Mini Printers",
          items: [
            {
              label: "Tiny-M",
              items: [
                { slug: "printers/tiny-m" },
                { label: "Tiny-M Mods", link: "/printers/tiny-m/mods/" },
              ],
            },
            {
              label: "Tiny-T",
              items: [
                { slug: "printers/tiny-t" },
                { label: "Tiny-T Mods", link: "/printers/tiny-t/mods/" },
              ],
            },
          ],
        },
      ],
      editLink: {
        baseUrl:
          "https://github.com/psytrx/pfa-website/edit/main/src/content/docs/",
      },
      components: {
        Footer: "./src/components/CustomFooter.astro",
        MarkdownContent: "./src/components/CustomMarkdownContent.astro",
      },
    }),
  ],
});
