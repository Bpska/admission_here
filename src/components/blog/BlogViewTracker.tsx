"use client";
import { useEffect, useState } from "react";
import {
  ACTIVE_READING_THRESHOLD_MS,
  activeReadingDelta,
} from "@/lib/active-reading";

export function BlogViewTracker({
  blogId,
  initialViews,
}: {
  blogId: string;
  initialViews: number;
}) {
  const [views, setViews] = useState(initialViews);
  useEffect(() => {
    let disposed = false;
    let counted = false;
    let ticket = "";
    let accumulated = 0;
    let previousAt = performance.now();
    let lastActivityAt = previousAt;
    let sending = false;
    let ignored = false;
    let nextAttempt = 0;
    let failures = 0;
    let pendingStart: AbortController | null = null;
    const foreground = () =>
      document.visibilityState === "visible" && document.hasFocus();
    function activity() {
      lastActivityAt = performance.now();
    }
    function visibility() {
      previousAt = performance.now();
      if (foreground()) {
        activity();
        nextAttempt = 0;
        void tick();
      }
    }
    function online() {
      nextAttempt = 0;
      void tick();
    }
    async function tick() {
      const now = performance.now();
      if (disposed || counted || ignored) return;
      if (ticket)
        accumulated += activeReadingDelta(
          previousAt,
          now,
          foreground(),
          lastActivityAt,
        );
      previousAt = now;
      if (
        sending ||
        now < nextAttempt ||
        !foreground() ||
        navigator.onLine === false
      )
        return;
      if (ticket && accumulated < ACTIVE_READING_THRESHOLD_MS) return;
      sending = true;
      const completing = !!ticket;
      const controller = new AbortController();
      if (!completing) pendingStart = controller;
      // A stalled request must not stop tracking for the rest of this visit.
      const timeout = window.setTimeout(() => controller.abort(), 15_000);
      let retryAfterMs = 0;
      try {
        const response = await fetch(`/api/v1/blogs/${blogId}/views`, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          keepalive: completing,
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify(
            completing
              ? {
                  action: "complete",
                  ticket,
                  activeMs: Math.floor(accumulated),
                }
              : { action: "start" },
          ),
        });
        if (response.status === 204 || response.status === 404) {
          ignored = true;
          return;
        }
        retryAfterMs = Math.min(
          60_000,
          Math.max(0, Number(response.headers.get("Retry-After")) || 0) * 1000,
        );
        const result = await response.json();
        if (disposed) return;
        if (!response.ok) {
          if (result.code === "BLOG_VIEW_TICKET_INVALID") {
            ticket = "";
            accumulated = 0;
          }
          throw Error("View tracking unavailable");
        }
        if (!completing) {
          if (typeof result.ticket !== "string" || !result.ticket)
            throw Error("Invalid view ticket");
          ticket = result.ticket;
          previousAt = performance.now();
          lastActivityAt = previousAt;
        } else {
          if (
            typeof result.views !== "number" ||
            !Number.isFinite(result.views)
          )
            throw Error("Invalid view count");
          counted = true;
          setViews(result.views);
        }
        failures = 0;
      } catch {
        if (!disposed) {
          // Cold starts, brief database outages and lost responses can recover.
          // Keep the same completion ticket: the server deduplicates retries.
          failures++;
          nextAttempt =
            performance.now() +
            Math.max(
              retryAfterMs,
              Math.min(60_000, 5000 * 2 ** Math.min(failures - 1, 4)),
            );
        }
      } finally {
        window.clearTimeout(timeout);
        if (pendingStart === controller) pendingStart = null;
        sending = false;
      }
    }
    const events = [
      "pointerdown",
      "pointermove",
      "keydown",
      "scroll",
      "touchstart",
    ] as const;
    events.forEach((event) =>
      window.addEventListener(event, activity, { passive: true }),
    );
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", visibility);
    window.addEventListener("blur", visibility);
    window.addEventListener("online", online);
    const timer = window.setInterval(() => void tick(), 1000);
    void tick();
    return () => {
      disposed = true;
      pendingStart?.abort();
      window.clearInterval(timer);
      events.forEach((event) => window.removeEventListener(event, activity));
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", visibility);
      window.removeEventListener("blur", visibility);
      window.removeEventListener("online", online);
    };
  }, [blogId]);
  return (
    <span title="One view per article visit after 45 active seconds. Background and unfocused time do not count.">
      {views.toLocaleString("en-IN")} Views
    </span>
  );
}
