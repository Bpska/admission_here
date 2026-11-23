"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { articleHeadings } from "@/lib/blog-heading-ids";
import { BLOG_IMAGE_PLACEHOLDER } from "@/lib/blog-image-display";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

const schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "u",
    "mark",
    "figure",
    "figcaption",
  ],
};

export function BlogProse({ content }: { content: string }) {
  const scope = useId();
  const headingPlugin = useMemo(() => articleHeadings(scope), [scope]);
  const prose = useRef<HTMLDivElement>(null);
  const [headings, setHeadings] = useState<
    { id: string; text: string; nested: boolean }[]
  >([]);
  useEffect(() => {
    setHeadings(
      Array.from(
        prose.current?.querySelectorAll("h2[id], h3[id]") || [],
        (element) => ({
          id: element.id,
          text: element.textContent?.trim() || "",
          nested: element.tagName === "H3",
        }),
      ).filter((item) => item.text),
    );
  }, [content]);
  return (
    <div className="min-w-0 space-y-6">
      {headings.length >= 2 && (
        <nav
          aria-label="On this page"
          className="rounded-xl border bg-muted/20 p-4 sm:p-5"
        >
          <details open>
            <summary className="cursor-pointer text-sm font-bold">
              On this page
            </summary>
            <ul className="mt-3 space-y-2 text-sm">
              {headings.map((heading) => (
                <li key={heading.id} className={heading.nested ? "pl-4" : ""}>
                  <a
                    href={`#${heading.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {heading.text}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </nav>
      )}
      <div ref={prose} className="blog-prose min-w-0 break-words">
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, [rehypeSanitize, schema], headingPlugin]}
          components={{
            a: ({ node: _node, href, ...props }) => {
              const internal =
                href?.startsWith("#") ||
                (href?.startsWith("/") && !href.startsWith("//"));
              return (
                <a
                  {...props}
                  href={href}
                  target={internal ? undefined : "_blank"}
                  rel={internal ? undefined : "noopener noreferrer"}
                />
              );
            },
            img: ({ node: _node, alt, ...props }) => (
              <img
                {...props}
                alt={alt || "Blog picture"}
                loading="lazy"
                decoding="async"
                onError={(event) => {
                  if (event.currentTarget.dataset.fallback) return;
                  event.currentTarget.dataset.fallback = "true";
                  event.currentTarget.src = BLOG_IMAGE_PLACEHOLDER;
                }}
              />
            ),
          }}
        >
          {content}
        </Markdown>
      </div>
    </div>
  );
}
