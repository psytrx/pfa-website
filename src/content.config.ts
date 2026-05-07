import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { modsLoader } from "./loaders/mods-loader";

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
      branch: z.string().default("main"),
      order: z.number(),
      mods: z
        .object({
          repo: z.string(),
          path: z.string(),
        })
        .optional(),
    }),
});

const printerMods = defineCollection({
  loader: modsLoader(),
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
});

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema(),
  }),
  printers,
  "printer-mods": printerMods,
};
