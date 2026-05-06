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
          items: ["printers/micron", "printers/salad-fork"],
        },
        {
          label: "V0 Mods",
          items: [
            "printers/dueling-zero",
            "printers/double-dragon",
            "printers/crucible",
            "printers/f-zero",
            "printers/tri-zero",
            "printers/pandoras-box",
            "printers/hex-zero",
          ],
        },
        {
          label: "Barely Bigger Mini Printers",
          items: ["printers/tiny-m", "printers/tiny-t"],
        },
      ],
      editLink: {
        baseUrl:
          "https://github.com/psytrx/pfa-website/edit/main/src/content/docs/",
      },
      components: {
        Footer: "./src/components/CustomFooter.astro",
      },
    }),
  ],
});
