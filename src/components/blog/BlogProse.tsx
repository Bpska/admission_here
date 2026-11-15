"use client";

import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), "u", "mark", "figure", "figcaption"],
};

export function BlogProse({ content }: { content: string }) {
  return <div className="blog-prose min-w-0 break-words">
    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]} components={{
      a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
      img: ({ node: _node, alt, ...props }) => <img {...props} alt={alt || "Blog picture"} loading="lazy" decoding="async" />,
    }}>{content}</Markdown>
  </div>;
}
