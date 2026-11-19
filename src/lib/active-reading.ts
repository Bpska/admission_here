export const ACTIVE_READING_THRESHOLD_MS = 45_000;
export const READING_IDLE_MS = 60_000;
/** Count only foreground, focused reading; ignore long timer gaps from suspension. */
export function activeReadingDelta(previousAt: number, now: number, foreground: boolean, lastActivityAt: number) {
  if (!foreground || now <= previousAt) return 0;
  return Math.max(0, Math.min(now - previousAt, 2000, lastActivityAt + READING_IDLE_MS - previousAt));
}
