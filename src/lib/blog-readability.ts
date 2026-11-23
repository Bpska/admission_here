import { marked } from "marked";
import { cleanBlogBody } from "./blog-content";

function decodeText(value: string) {
  const entities: Record<string, string> = {
    amp: "&",
    nbsp: " ",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    ndash: "–",
    mdash: "—",
    hellip: "…",
  };
  return value.replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (original, code: string) => {
      if (!code.startsWith("#"))
        return entities[code.toLowerCase()] ?? original;
      const point =
        code[1].toLowerCase() === "x"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    },
  );
}
export function textFromBlogHtml(html: string) {
  return decodeText(
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]*>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}
function attribute(tag: string, name: string) {
  const match = tag.match(
    new RegExp(
      `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
      "i",
    ),
  );
  return decodeText(match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
}
export function analyzeBlogContent(
  content: string,
  origin = process.env.NEXT_PUBLIC_APP_URL || "https://admissionshub.in",
) {
  const body = cleanBlogBody(content).replace(
    /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );
  const html = marked.parse(body, { async: false });
  const text = textFromBlogHtml(html);
  const wordCount =
    text.match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu)?.length || 0;
  const headings = Array.from(
    html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi),
    (match) => ({ level: Number(match[1]), text: textFromBlogHtml(match[2]) }),
  );
  const images = Array.from(html.matchAll(/<img\b[^>]*>/gi), (match) => ({
    src: attribute(match[0], "src"),
    alt: attribute(match[0], "alt"),
  }));
  let internalLinks = 0,
    externalLinks = 0;
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const href = attribute(match[0], "href");
    if (!href || href.startsWith("#")) continue;
    try {
      const url = new URL(href, origin);
      if (!["http:", "https:"].includes(url.protocol)) continue;
      if (url.origin === new URL(origin).origin) internalLinks++;
      else externalLinks++;
    } catch {
      /* Ignore malformed URLs in editorial checks. */
    }
  }
  return {
    text,
    wordCount,
    readingMinutes: Math.max(1, Math.ceil(wordCount / 200)),
    headings,
    images,
    internalLinks,
    externalLinks,
    intro: textFromBlogHtml(
      html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "",
    ),
  };
}
export function topicAppears(text: string, topic: string) {
  const normalized = (value: string) =>
    value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const phrase = normalized(topic);
  return !!phrase && ` ${normalized(text)} `.includes(` ${phrase} `);
}
