import { Marked } from "marked";

export function resolveRelativeImageUrl(href: string, rawBase: string): string {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) return href;

  const base = `${rawBase.replace(/\/+$/, "")}/`;
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

function normalizeHtmlImageSources(html: string, rawBase: string): string {
  return html.replace(
    /(<img\b[^>]*\bsrc\s*=\s*)(["'])(.*?)\2/gi,
    (_match, prefix: string, quote: string, href: string) =>
      `${prefix}${quote}${resolveRelativeImageUrl(href, rawBase)}${quote}`,
  );
}

export function renderMarkdownWithRelativeImages(
  markdown: string,
  rawBase: string,
) {
  const parser = new Marked({
    walkTokens(token) {
      if (token.type === "image") {
        token.href = resolveRelativeImageUrl(token.href, rawBase);
      } else if (token.type === "html") {
        token.text = normalizeHtmlImageSources(token.text, rawBase);
      }
    },
  });

  return parser.parse(markdown);
}
