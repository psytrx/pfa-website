import { marked } from "marked";

export function useRelativeImageBase(rawBase: string) {
  marked.use({
    walkTokens(token) {
      if (token.type === "image" && !/^https?:\/\//.test(token.href)) {
        const relative = token.href.replace(/^\.\//, "");
        token.href = `${rawBase}/${relative}`;
      }
    },
  });
}
