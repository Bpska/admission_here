"use client";
import { useEffect, useRef, useState } from "react";
import {
  BLOG_IMAGE_PLACEHOLDER,
  safeBlogImageUrl,
} from "@/lib/blog-image-display";
export function BlogCoverImage({
  src,
  alt,
  priority = false,
  variant = "card",
  className = "",
}: {
  src?: string | null;
  alt: string;
  priority?: boolean;
  variant?: "card" | "article";
  className?: string;
}) {
  const url = safeBlogImageUrl(src) || BLOG_IMAGE_PLACEHOLDER;
  const imageRef = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const display = failed === url ? BLOG_IMAGE_PLACEHOLDER : url;
  useEffect(() => {
    // The browser may finish a failed request before React attaches onError.
    const image = imageRef.current;
    if (
      image?.complete &&
      image.naturalWidth === 0 &&
      display !== BLOG_IMAGE_PLACEHOLDER
    ) {
      setFailed(url);
    }
  }, [url, display]);
  return (
    <div
      data-blog-cover
      className={`relative isolate w-full min-w-0 shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-900 ${className}`}
      style={variant === "card" ? { aspectRatio: "16 / 10" } : undefined}
    >
      {/* Direct rendering supports uploaded API pictures and external covers without optimizer/auth mismatches. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={display}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        width={1200}
        height={variant === "article" ? 675 : 750}
        className={
          variant === "article"
            ? "block h-auto w-full object-contain object-center"
            : "absolute inset-0 block h-full w-full object-cover object-center"
        }
        onError={() => {
          if (display !== BLOG_IMAGE_PLACEHOLDER) setFailed(url);
        }}
      />
    </div>
  );
}
