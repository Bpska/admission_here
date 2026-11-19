"use client";
import { useEffect, useRef, useState } from "react";
import { ACTIVE_READING_THRESHOLD_MS, activeReadingDelta } from "@/lib/active-reading";

export function BlogViewTracker({ blogId, initialViews }: { blogId: string; initialViews: number }) {
  const [views, setViews] = useState(initialViews);
  const counted = useRef(false);
  useEffect(() => {
    let disposed = false;
    let ticket = "";
    let accumulated = 0;
    let previousAt = performance.now();
    let lastActivityAt = previousAt;
    let sending = false;
    let ignored = false;
    let nextAttempt = 0;
    let failures = 0;
    const controller = new AbortController();
    const foreground = () => document.visibilityState === "visible" && document.hasFocus();
    function activity() { lastActivityAt = performance.now(); }
    function visibility() { previousAt = performance.now(); if (foreground()) activity(); }
    async function tick() {
      const now = performance.now();
      if (disposed || counted.current || ignored) return;
      if (ticket) accumulated += activeReadingDelta(previousAt, now, foreground(), lastActivityAt);
      previousAt = now;
      if (sending || failures >= 3 || now < nextAttempt || !foreground()) return;
      if (ticket && accumulated < ACTIVE_READING_THRESHOLD_MS) return;
      sending = true;
      try {
        const response = await fetch(`/api/v1/blogs/${blogId}/views`, {
          method: "POST", credentials: "same-origin", cache: "no-store", keepalive: !!ticket,
          headers: { "Content-Type": "application/json" }, signal: ticket ? undefined : controller.signal,
          body: JSON.stringify(ticket ? { action: "complete", ticket, activeMs: Math.floor(accumulated) } : { action: "start" }),
        });
        if (response.status === 204) { ignored = true; return; }
        if (!response.ok) throw Error("View tracking unavailable");
        const result = await response.json();
        if (disposed) return;
        if (!ticket) { ticket = result.ticket; previousAt = performance.now(); lastActivityAt = previousAt; }
        else { counted.current = true; if (typeof result.views === "number") setViews(result.views); }
      } catch { if (!disposed) { failures++; nextAttempt = performance.now() + 5000; } }
      finally { sending = false; }
    }
    const events = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"] as const;
    events.forEach(event => window.addEventListener(event, activity, { passive: true }));
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", visibility);
    window.addEventListener("blur", visibility);
    const timer = window.setInterval(() => void tick(), 1000);
    void tick();
    return () => {
      disposed = true; controller.abort(); window.clearInterval(timer);
      events.forEach(event => window.removeEventListener(event, activity));
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", visibility); window.removeEventListener("blur", visibility);
    };
  }, [blogId]);
  return <span title="One view per article visit after 45 active seconds. Background and unfocused time do not count.">{views.toLocaleString("en-IN")} Views</span>;
}
