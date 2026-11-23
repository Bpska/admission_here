"use client";

import { useEffect, useRef, useState } from "react";
import { SignInPrompt, currentPageLoginHref } from "@/components/auth/SignInPrompt";
import { Heart, MessageCircle, Send, UserRound } from "lucide-react";

export type Engagement = {
  viewer?: { name: string } | null;
  likesEnabled: boolean;
  commentsEnabled: boolean;
  likes: number;
  liked: boolean;
  commentCount: number;
  comments: { id: string; name: string; body: string; createdAt: string }[];
};
type Action = { action: "like"; liked: boolean } | { action: "comment"; body: string };

function Avatar({ name }: { name: string }) {
  return <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-100 to-orange-100 text-xs font-bold text-fuchsia-900 ring-1 ring-black/5 dark:from-fuchsia-950 dark:to-orange-950 dark:text-fuchsia-100">{name.trim() ? name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() : <UserRound className="h-4 w-4" />}</span>;
}

export function BlogEngagement({ blogId, initialData }: { blogId: string; initialData?: Engagement }) {
  const [data, setData] = useState<Engagement | null>(initialData || null);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setReady(false);
    setError("");
    fetch(`/api/v1/blogs/${blogId}/engagement`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw Error(result.error);
        if (!controller.signal.aborted) { setData(result); setReady(true); }
      })
      .catch(error => { if (!controller.signal.aborted) setError(error.message || "Unable to load comments."); });
    return () => controller.abort();
  }, [blogId, attempt]);

  async function send(payload: Action) {
    if (busy || !ready || !data) return;
    if (!data.viewer) { window.location.assign(currentPageLoginHref("#blog-comments")); return; }
    const previous = data;
    setBusy(true);
    setError("");
    if (payload.action === "like") {
      setData({ ...data, liked: payload.liked, likes: Math.max(0, data.likes + (payload.liked ? 1 : -1)) });
    }
    try {
      const response = await fetch(`/api/v1/blogs/${blogId}/engagement`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (response.status === 401) {
        setData({ ...previous, viewer: null });
        window.location.assign(currentPageLoginHref("#blog-comments"));
        return;
      }
      if (!response.ok) throw Error(result.error);
      if (payload.action === "comment") {
        setData(result);
        setBody("");
        if (commentRef.current) commentRef.current.style.height = "auto";
      } else setData(result);
    } catch (error) {
      if (payload.action === "like") setData(previous);
      setError(error instanceof Error ? error.message : "Unable to save.");
    } finally { setBusy(false); }
  }

  function focusComposer() {
    if (!data?.viewer) { window.location.assign(currentPageLoginHref("#blog-comments")); return; }
    commentRef.current?.focus();
  }
  const visibleComments = data ? (expanded ? data.comments : data.comments.slice(0, 2)) : [];

  return <section id="blog-comments" aria-label="Likes and comments" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
    {!data && !error && <p role="status" className="p-5 text-sm text-muted-foreground">Loading likes and comments…</p>}
    {data && <>
      <div className="space-y-3 px-5 pb-4 pt-5 sm:px-6">
        <div className="flex items-center gap-4">
          {data.likesEnabled && <button type="button" disabled={busy || !ready} aria-label={data.liked ? "Unlike article" : "Like article"} aria-pressed={data.liked} onClick={() => void send({ action: "like", liked: !data.liked })} className="group -m-2 rounded-full p-2 transition-transform hover:scale-110 active:scale-90 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transform-none">
            <Heart strokeWidth={1.7} className={`h-7 w-7 transition-all duration-200 motion-reduce:transition-none ${data.liked ? "fill-rose-500 text-rose-500" : "text-foreground group-hover:text-muted-foreground"}`} />
          </button>}
          {data.commentsEnabled && <button type="button" aria-label="Write a comment" disabled={busy || !ready} onClick={focusComposer} className="-m-2 rounded-full p-2 text-foreground transition-transform hover:scale-110 active:scale-90 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transform-none"><MessageCircle strokeWidth={1.7} className="h-7 w-7 -scale-x-100" /></button>}
          <span className="ml-auto text-xs text-muted-foreground">Join the conversation</span>
        </div>
        {data.likesEnabled && <p aria-live="polite" className="text-sm font-semibold tabular-nums">{data.likes.toLocaleString("en-IN")} {data.likes === 1 ? "like" : "likes"}</p>}
        <h2 className="text-sm font-semibold">Comments{data.commentsEnabled && <span className="ml-2 font-normal text-muted-foreground">{data.commentCount.toLocaleString("en-IN")}</span>}</h2>
        {!data.commentsEnabled ? <p className="text-sm text-muted-foreground">Comments are closed for this article.</p> : <>
          {!data.comments.length && <p className="text-sm text-muted-foreground">Start the conversation. Share your thoughts below.</p>}
          <div className="space-y-4">{visibleComments.map(comment => <article key={comment.id} className="flex items-start gap-3">
            <Avatar name={comment.name} />
            <div className="min-w-0 flex-1 space-y-1"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed"><span className="mr-2 font-semibold">{comment.name}</span>{comment.body}</p><time className="block text-[11px] text-muted-foreground" dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}</time></div>
          </article>)}</div>
          {data.comments.length > 2 && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="text-sm text-muted-foreground hover:text-foreground">{expanded ? "Show fewer comments" : data.commentCount > 50 ? `View latest 50 of ${data.commentCount} comments` : `View all ${data.commentCount} comments`}</button>}

        </>}
      </div>
      {data.commentsEnabled && data.viewer && <form aria-label="Add a comment" onSubmit={event => { event.preventDefault(); void send({ action: "comment", body }); }} className="border-t border-border">
        <div className="flex items-center gap-3 px-5 pt-4 sm:px-6"><Avatar name={data.viewer.name} /><p className="min-w-0 break-words text-sm font-semibold">{data.viewer.name}</p></div>
        <div className="flex items-end gap-3 px-5 pb-3 pl-[4.25rem] pt-2 sm:px-6 sm:pl-[4.5rem]"><label className="min-w-0 flex-1"><span className="sr-only">Comment</span><textarea ref={commentRef} required minLength={2} maxLength={2000} rows={1} value={body} onChange={event => { setBody(event.target.value); event.target.style.height = "auto"; event.target.style.height = `${Math.min(event.target.scrollHeight, 144)}px`; }} disabled={busy || !ready} placeholder="Add a comment…" className="block max-h-36 min-h-8 w-full resize-none border-0 bg-transparent py-1 text-sm leading-6 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary" /></label><button type="submit" aria-label="Submit comment" disabled={busy || !ready || body.trim().length < 2} className="mb-1 inline-flex shrink-0 items-center gap-1.5 rounded px-1 py-1 text-sm font-semibold text-sky-600 transition-colors hover:text-sky-800 disabled:opacity-40 dark:text-sky-400 dark:hover:text-sky-300"><span>{busy ? "Posting…" : "Post"}</span><Send className="h-4 w-4 sm:hidden" /></button></div>
      </form>}
      {(data.commentsEnabled || data.likesEnabled) && !data.viewer && <div className="border-t p-5 sm:p-6"><SignInPrompt message="Sign in to like this article and join the comments." anchor="#blog-comments" /></div>}
    </>}
    {error && <p role="alert" className="border-t p-4 text-sm text-red-600">{error} {!ready && <button type="button" onClick={() => setAttempt(value => value + 1)} className="ml-2 underline">Retry</button>}</p>}
  </section>;
}
