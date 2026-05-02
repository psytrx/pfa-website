// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: "PrintersForAnts",
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
              link: "https://github.com/hartk1213/Micron",
              attrs: { target: "_blank" },
            },
            {
              label: "Salad Fork",
              link: "https://github.com/PrintersForAnts/Salad_Fork",
              attrs: { target: "_blank" },
            },
          ],
        },
        {
          label: "V0 Mods",
          items: [
            {
              label: "Dueling Zero",
              link: "https://github.com/zruncho3d/DuelingZero",
              attrs: { target: "_blank" },
            },
            {
              label: "Double Dragon",
              link: "https://github.com/zruncho3d/double-dragon",
              attrs: { target: "_blank" },
            },
            {
              label: "Crucible",
              link: "https://github.com/PrintersForAnts/Crucible",
              attrs: { target: "_blank" },
            },
            {
              label: "F-Zero",
              link: "https://github.com/zruncho3d/f-zero",
              attrs: { target: "_blank" },
            },
            {
              label: "Tri-Zero",
              link: "https://github.com/zruncho3d/tri-zero",
              attrs: { target: "_blank" },
            },
            {
              label: "Pandora's Box",
              link: "https://github.com/masturmynd/pandoras_box/",
              attrs: { target: "_blank" },
            },
            {
              label: "Hex-Zero",
              link: "https://github.com/Alexander-T-Moss/Hex-Zero",
              attrs: { target: "_blank" },
            },
          ],
        },
        {
          label: "Barely Bigger Mini Printers",
          items: [
            {
              label: "Tiny-M",
              link: "https://github.com/gsl12/Tiny-M",
              attrs: { target: "_blank" },
            },
            {
              label: "Tiny-T",
              link: "https://github.com/PrintersForAnts/Tiny-T",
              attrs: { target: "_blank" },
            },
          ],
        },
      ],
      components: {
        Footer: "./src/components/CustomFooter.astro",
      },
    }),
  ],
});
