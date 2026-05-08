import { marked } from "marked";

export function useRelativeImageBase(rawBase: string) {
  marked.use({
    walkTokens(token) {
      console.log({ token });
      if (token.type === "image" && !/^https?:\/\//.test(token.href)) {
        console.log(token);
        const relative = token.href.replace(/^\.\//, "");
        token.href = `${rawBase}/${relative}`;
      }
    },
  });
}
