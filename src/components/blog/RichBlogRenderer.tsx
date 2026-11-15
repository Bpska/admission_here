"use client";

import { BlogTldrBox } from "./BlogTldrBox";
import { LiveBlogTicker, type LiveUpdateItem } from "./LiveBlogTicker";
import { EmbeddedCollegeCTA } from "./EmbeddedCollegeCTA";
import { useEffect, useState } from "react";
import { BlogProse } from "./BlogProse";
import { cleanBlogBody, normalizeBlogBlocks } from "@/lib/blog-content";

interface RichBlogRendererProps {
  content: string;
  tldrSummary?: string[];
  isLiveBlog?: boolean;
  liveUpdates?: LiveUpdateItem[];
  relatedCollege?: {
    id: string;
    slug: string;
    name: string;
    city: string;
    state: string;
    nirfRank?: number | null;
    ratingOverall: number;
    logoUrl?: string | null;
  } | null;
  blogId: string;
}

export function RichBlogRenderer({
  content,
  tldrSummary,
  isLiveBlog,
  liveUpdates,
  relatedCollege,
  blogId,
}: RichBlogRendererProps) {
  const normalizedContent = normalizeBlogBlocks(content);
  const [embedded, setEmbedded] = useState<NonNullable<RichBlogRendererProps["relatedCollege"]>[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    const slugs = Array.from(normalizedContent.matchAll(/<EmbeddedCollegeCTA\s+slug=["']([^"']+)["'][^>]*\/>/g), match => match[1]);
    setEmbedded([]);
    Promise.all(Array.from(new Set(slugs)).map(async slug => {
      const response = await fetch(`/api/v1/colleges/by-slug/${encodeURIComponent(slug)}`, { signal: controller.signal });
      return response.ok ? (await response.json()).college : null;
    })).then(items => { if (!controller.signal.aborted) setEmbedded(items.filter(Boolean)); }).catch(() => {});
    return () => controller.abort();
  }, [normalizedContent]);

  return (
    <article className="max-w-4xl mx-auto">
      {/* 1. TL;DR AI & GEO Box */}
      {tldrSummary && tldrSummary.length > 0 && (
        <BlogTldrBox bullets={tldrSummary} />
      )}

      {/* 2. Embedded College Card if high-intent */}
      {relatedCollege && !embedded.some(college => college.id === relatedCollege.id) && (
        <EmbeddedCollegeCTA college={relatedCollege} blogId={blogId} />
      )}
      {embedded.map(college => <EmbeddedCollegeCTA key={college.id} college={college} blogId={blogId} />)}

      {/* 3. Live Ticker for Exam Results / Live Feeds */}
      {isLiveBlog && liveUpdates && liveUpdates.length > 0 && (
        <LiveBlogTicker updates={liveUpdates} />
      )}

      {/* 4. Article Main Body */}
      <BlogProse content={cleanBlogBody(content)} />
    </article>
  );
}

