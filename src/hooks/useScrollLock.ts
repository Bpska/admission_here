"use client";

import { useEffect } from "react";

let activeLocks = 0;
let restoreScroll: (() => void) | undefined;

/** Keep the page stationary until every open overlay has closed. */
export function useScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return;

    if (activeLocks === 0) {
      const root = document.documentElement;
      const body = document.body;
      const rootOverflow = root.style.overflow;
      const bodyOverflow = body.style.overflow;
      const bodyPadding = body.style.paddingRight;
      const scrollbarWidth = window.innerWidth - root.clientWidth;

      root.style.overflow = "hidden";
      body.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${parseFloat(window.getComputedStyle(body).paddingRight) + scrollbarWidth}px`;
      }

      restoreScroll = () => {
        root.style.overflow = rootOverflow;
        body.style.overflow = bodyOverflow;
        body.style.paddingRight = bodyPadding;
      };
    }

    activeLocks += 1;
    return () => {
      activeLocks -= 1;
      if (activeLocks === 0) {
        restoreScroll?.();
        restoreScroll = undefined;
      }
    };
  }, [open]);
}
