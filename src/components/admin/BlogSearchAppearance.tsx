"use client";
import { useEffect, useId, useMemo, useState } from "react";
import { analyzeBlogContent } from "@/lib/blog-readability";
import { suggestBlogMetadata } from "@/lib/blog-suggestions";
import { BlogCoverImage } from "@/components/blog/BlogCoverImage";

export function BlogSearchAppearance({
  title,
  metaTitle,
  metaDescription,
  content,
  featuredImageUrl,
  previewPath,
  onTitleChange,
  onDescriptionChange,
  disabled,
}: {
  title: string;
  metaTitle: string;
  metaDescription: string;
  content: string;
  featuredImageUrl: string;
  previewPath: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  disabled: boolean;
}) {
  const id = useId();
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const analysis = useMemo(() => analyzeBlogContent(content), [content]);
  const suggested = useMemo(
    () => suggestBlogMetadata(title, analysis.text),
    [title, analysis.text],
  );
  const previewTitle = metaTitle.trim() || title.trim();
  const previewDescription =
    metaDescription.trim() || suggested.metaDescription;
  const button =
    "text-xs font-semibold text-primary underline underline-offset-2 disabled:text-muted-foreground disabled:no-underline";
  return (
    <section
      aria-label="Search appearance"
      className="rounded-xl border bg-card p-5 space-y-4"
    >
      <h2 className="font-bold text-sm">Search appearance</h2>
      <div className="space-y-1.5">
        <div className="flex flex-wrap justify-between gap-2 text-xs">
          <label htmlFor={`${id}-title`} className="font-semibold">
            SEO meta title
          </label>
          <span className="text-muted-foreground">
            {metaTitle.length} characters
          </span>
        </div>
        <input
          id={`${id}-title`}
          value={metaTitle}
          onChange={(event) => onTitleChange(event.target.value)}
          disabled={disabled}
          placeholder="A clear, specific title for search"
          className="w-full rounded-lg border bg-background px-3 py-2 text-xs"
        />
        <button
          type="button"
          disabled={disabled || !title.trim()}
          onClick={() => onTitleChange(suggested.metaTitle)}
          className={button}
        >
          Suggest from title
        </button>
        <p className="text-[11px] text-muted-foreground">
          Aim for roughly 50–60 characters. Leave blank to use the article
          title.
        </p>
      </div>
      <div className="space-y-1.5">
        <div className="flex flex-wrap justify-between gap-2 text-xs">
          <label htmlFor={`${id}-description`} className="font-semibold">
            Meta description
          </label>
          <span className="text-muted-foreground">
            {metaDescription.length} characters
          </span>
        </div>
        <textarea
          id={`${id}-description`}
          rows={4}
          value={metaDescription}
          onChange={(event) => onDescriptionChange(event.target.value)}
          disabled={disabled}
          placeholder="Explain what the reader will learn"
          className="w-full rounded-lg border bg-background p-2.5 text-xs"
        />
        <button
          type="button"
          disabled={disabled || !analysis.text}
          onClick={() => onDescriptionChange(suggested.metaDescription)}
          className={button}
        >
          Suggest from article
        </button>
        <p className="text-[11px] text-muted-foreground">
          Around 120–160 characters is a useful guide, not a search-engine
          limit.
        </p>
      </div>
      <div
        className="space-y-2 border-t pt-4"
        aria-label="Search result preview"
      >
        <p className="text-xs font-semibold">Search result preview</p>
        <div className="overflow-hidden rounded-lg border bg-background p-3">
          <p className="break-all text-[11px] text-muted-foreground">
            {origin ? `${origin}${previewPath}` : previewPath}
          </p>
          <p className="mt-1 break-words text-base leading-snug text-blue-800 dark:text-blue-300">
            {previewTitle || "Your article title"}
          </p>
          <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
            {previewDescription ||
              "Write an introduction or meta description to preview the summary."}
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Search engines may choose different wording. New article URLs are
          finalized when saved.
        </p>
      </div>
      <details className="border-t pt-3">
        <summary className="cursor-pointer text-xs font-semibold">
          Social sharing preview
        </summary>
        <div className="mt-3 overflow-hidden rounded-lg border">
          <BlogCoverImage
            src={featuredImageUrl || "/logo.png"}
            alt={title || "Article cover preview"}
            variant="article"
          />
          <div className="space-y-1 p-3">
            <p className="break-words text-sm font-bold">
              {previewTitle || "Your article title"}
            </p>
            <p className="break-words text-xs text-muted-foreground">
              {previewDescription || "Your article summary"}
            </p>
          </div>
        </div>
      </details>
    </section>
  );
}
