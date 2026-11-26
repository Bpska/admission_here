import { PostStatus } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Automatically transitions any SCHEDULED blog posts whose scheduled `publishedAt`
 * timestamp has arrived into PUBLISHED status.
 * Safe to call on public blog reads and CMS reads — uses the indexed status + publishedAt fields.
 */
export async function publishDueScheduledBlogs() {
  try {
    const now = new Date();
    const result = await db.blogPost.updateMany({
      where: {
        status: PostStatus.SCHEDULED,
        publishedAt: {
          lte: now,
        },
      },
      data: {
        status: PostStatus.PUBLISHED,
      },
    });
    return result.count;
  } catch (err) {
    console.warn("publishDueScheduledBlogs warning:", err);
    return 0;
  }
}

/** Format a Date to local `YYYY-MM-DDTHH:mm` for `<input type="datetime-local" />`. */
export function toDateTimeLocalValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const offsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
}
