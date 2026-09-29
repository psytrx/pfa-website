import type { Loader } from "astro/loaders";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { printers } from "../content/printers";

export function printersLoader(): Loader {
  return {
    name: "printer-config",
    load: async ({ store, parseData, config }) => {
      store.clear();
      const root = fileURLToPath(config.root);
      const filePath = resolve(root, "src/content/printers.ts");
      const storedFilePath = relative(root, filePath).split(sep).join("/");

      for (const { id, ...data } of printers) {
        const parsedData = await parseData({
          id,
          data,
          filePath,
        });

        store.set({ id, data: parsedData, filePath: storedFilePath });
      }
    },
  };
}
