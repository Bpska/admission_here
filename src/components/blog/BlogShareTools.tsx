"use client";
import { useEffect, useState } from "react";
import { Copy, Share2, MessageCircle } from "lucide-react";

export function BlogShareTools({
  title,
  path,
  commentsEnabled,
}: {
  title: string;
  path: string;
  commentsEnabled: boolean;
}) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  useEffect(() => {
    setUrl(new URL(path, window.location.origin).href);
    setMessage("");
    setManualCopy(false);
  }, [path]);
  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setManualCopy(false);
      setMessage("Link copied.");
    } catch {
      setManualCopy(true);
      setMessage("Select and copy the link below.");
    }
  }
  async function share() {
    if (!url) return;
    if (!navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({ title, url });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setManualCopy(true);
        setMessage("Use the link below to share this article.");
      }
    }
  }
  const style =
    "inline-flex min-h-10 items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-50";
  return (
    <div className="space-y-2" aria-label="Share this article">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={share} disabled={!url} className={style}>
          <Share2 className="h-3.5 w-3.5" />
          Share
        </button>
        <button type="button" onClick={copy} disabled={!url} className={style}>
          <Copy className="h-3.5 w-3.5" />
          Copy link
        </button>
        <a
          href={
            url
              ? `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`
              : undefined
          }
          aria-disabled={!url}
          target="_blank"
          rel="noopener noreferrer"
          className={style}
        >
          WhatsApp
        </a>
        {commentsEnabled && (
          <a href="#blog-comments" className={style}>
            <MessageCircle className="h-3.5 w-3.5" />
            Join the discussion
          </a>
        )}
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {message}
      </p>
      {manualCopy && (
        <input
          aria-label="Article link"
          value={url}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded-lg border bg-background p-2 text-sm"
        />
      )}
    </div>
  );
}
