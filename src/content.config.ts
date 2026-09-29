import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { file } from "astro/loaders";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { ModEntrySchema, modsLoader } from "./loaders/mods-loader";

const printers = defineCollection({
  loader: file("src/content/printers.yaml"),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      subline: z.string(),
      description: z.string(),
      image: image(),
      github: z.object({
        url: z.string(),
        branch: z.string(),
        readme: z.string(),
      }),
      documentation_pdf: z.string().optional(),
      category: z.enum(["scratch-builds", "v0-mods", "barely-bigger"]),
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
  schema: ModEntrySchema,
});

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema(),
  }),
  printers,
  "printer-mods": printerMods,
};
