import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";

const printers = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/printers" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      subline: z.string(),
      description: z.string(),
      image: image(),
      link: z.string(),
      category: z.enum(["scratch-builds", "v0-mods", "barely-bigger"]),
      order: z.number(),
    }),
});

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema(),
  }),
  printers,
};
