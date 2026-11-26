import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { BlogCategory, PostStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { validateBlogDestination } from "@/lib/blog-destination";

const BatchCreateItemSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters"),
  category: z.nativeEnum(BlogCategory).default(BlogCategory.CUTOFF_ANALYSIS),
  contentMdx: z.string().trim().min(10, "Content must be at least 10 characters"),
  tags: z.array(z.string().trim().min(1)).default([]),
  metaDescription: z.string().trim().optional(),
  showOnWebsiteBlog: z.boolean().default(true),
  relatedCollegeSlug: z.string().trim().optional(),
  scheduledAt: z.string().datetime("Choose a valid date and time"),
});

const BatchRescheduleItemSchema = z.object({
  id: z.string().uuid(),
  scheduledAt: z.string().datetime("Choose a valid date and time"),
});

const BatchScheduleSchema = z.object({
  mode: z.enum(["create", "reschedule"]),
  items: z.array(z.any()).min(1, "Add at least one blog").max(50, "Maximum 50 blogs per batch"),
});

function makeSlug(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80)
      .replace(/^-+|-+$/g, "") || "article"
  );
}

/**
 * POST /api/v1/cms/blogs/schedule
 * - mode: "create"     -> Create multiple blogs at once, each scheduled for its own date & time
 * - mode: "reschedule" -> Schedule or reschedule multiple existing blogs at different dates & times
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user as any;
    const role = user?.role;
    const permissions: string[] = user?.permissions || [];

    if (role !== "SUPER_ADMIN" && !((role === "STAFF" || role === "AUTHOR") && permissions.includes("blogs"))) {
      return NextResponse.json({ error: "Unauthorized: blogs permission required" }, { status: 401 });
    }

    const canPublish =
      role === "SUPER_ADMIN" ||
      permissions.includes("blogs:publish") ||
      permissions.includes("blogs");

    if (!canPublish) {
      return NextResponse.json(
        { error: "Forbidden: publish permission required to schedule articles" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const outer = BatchScheduleSchema.safeParse(body);
    if (!outer.success) {
      return NextResponse.json(
        { error: outer.error.issues[0]?.message || "Invalid schedule payload" },
        { status: 400 }
      );
    }

    const now = Date.now();

    if (outer.data.mode === "create") {
      const parsedItems = z.array(BatchCreateItemSchema).min(1).max(50).safeParse(outer.data.items);
      if (!parsedItems.success) {
        const firstIssue = parsedItems.error.issues[0];
        const rowNum = typeof firstIssue?.path[0] === "number" ? `Blog #${firstIssue.path[0] + 1}: ` : "";
        return NextResponse.json(
          { error: `${rowNum}${firstIssue?.message || "Invalid blog entry"}` },
          { status: 400 }
        );
      }

      const resolvedAuthorId = user.id as string;
      const prepared: Array<{
        title: string;
        slug: string;
        category: BlogCategory;
        contentMdx: string;
        tags: string[];
        metaDescription: string | null;
        showOnWebsiteBlog: boolean;
        status: PostStatus;
        publishedAt: Date;
      }> = [];

      const usedSlugs = new Set<string>();

      for (let i = 0; i < parsedItems.data.length; i++) {
        const item = parsedItems.data[i];
        let content = item.contentMdx;
        if (!item.showOnWebsiteBlog && item.relatedCollegeSlug && !content.includes(`<EmbeddedCollegeCTA slug="${item.relatedCollegeSlug}"`)) {
          content = `${content}\n\n<EmbeddedCollegeCTA slug="${item.relatedCollegeSlug}" />`;
        }

        const destError = await validateBlogDestination(
          { showOnWebsiteBlog: item.showOnWebsiteBlog, contentMdx: content, relatedCollegeId: null },
          true
        );
        if (destError) {
          return NextResponse.json({ error: `Blog #${i + 1} (${item.title}): ${destError}` }, { status: 400 });
        }

        const scheduleDate = new Date(item.scheduledAt);
        let slug = makeSlug(item.title);
        if (usedSlugs.has(slug) || (await db.blogPost.findUnique({ where: { slug }, select: { id: true } }))) {
          slug = `${slug}-${randomUUID().slice(0, 8)}`;
        }
        usedSlugs.add(slug);

        prepared.push({
          title: item.title,
          slug,
          category: item.category,
          contentMdx: content,
          tags: item.tags,
          metaDescription: item.metaDescription || null,
          showOnWebsiteBlog: item.showOnWebsiteBlog,
          status: scheduleDate.getTime() > now ? PostStatus.SCHEDULED : PostStatus.PUBLISHED,
          publishedAt: scheduleDate,
        });
      }

      const created = await db.$transaction(
        prepared.map((entry) =>
          db.blogPost.create({
            data: {
              ...entry,
              tldrSummary: [],
              isLiveBlog: false,
              liveUpdatesJson: [],
              authorId: resolvedAuthorId,
            },
            include: {
              author: { select: { name: true, designation: true } },
            },
          })
        )
      );

      try {
        revalidatePath("/", "layout");
        revalidatePath("/blog");
        revalidatePath("/admin/blogs");
        revalidatePath("/admin/staff-blogs");
      } catch {
        /* ignore */
      }

      return NextResponse.json({
        success: true,
        posts: created,
        message: `${created.length} blog${created.length === 1 ? "" : "s"} scheduled successfully!`,
      });
    }

    // mode === "reschedule"
    const parsedUpdates = z.array(BatchRescheduleItemSchema).min(1).max(50).safeParse(outer.data.items);
    if (!parsedUpdates.success) {
      return NextResponse.json(
        { error: parsedUpdates.error.issues[0]?.message || "Invalid reschedule entry" },
        { status: 400 }
      );
    }

    const ids = parsedUpdates.data.map((i) => i.id);
    const existingPosts = await db.blogPost.findMany({
      where: { id: { in: ids } },
      select: { id: true, authorId: true, showOnWebsiteBlog: true, contentMdx: true, relatedCollegeId: true, title: true },
    });
    const byId = new Map(existingPosts.map((p) => [p.id, p]));

    for (const item of parsedUpdates.data) {
      const existing = byId.get(item.id);
      if (!existing) {
        return NextResponse.json({ error: "One or more selected blog posts were not found." }, { status: 404 });
      }
      if ((role === "STAFF" || role === "AUTHOR") && existing.authorId !== user.id) {
        return NextResponse.json({ error: "Forbidden: you can only schedule your own blog posts." }, { status: 403 });
      }
      const destError = await validateBlogDestination(
        { showOnWebsiteBlog: existing.showOnWebsiteBlog, contentMdx: existing.contentMdx, relatedCollegeId: existing.relatedCollegeId },
        true
      );
      if (destError) {
        return NextResponse.json({ error: `${existing.title}: ${destError}` }, { status: 400 });
      }
    }

    const updated = await db.$transaction(
      parsedUpdates.data.map((item) => {
        const scheduleDate = new Date(item.scheduledAt);
        return db.blogPost.update({
          where: { id: item.id },
          data: {
            status: scheduleDate.getTime() > now ? PostStatus.SCHEDULED : PostStatus.PUBLISHED,
            publishedAt: scheduleDate,
          },
          include: {
            author: { select: { name: true, designation: true } },
          },
        });
      })
    );

    try {
      revalidatePath("/", "layout");
      revalidatePath("/blog");
      revalidatePath("/admin/blogs");
      revalidatePath("/admin/staff-blogs");
    } catch {
      /* ignore */
    }

    return NextResponse.json({
      success: true,
      posts: updated,
      message: `${updated.length} blog${updated.length === 1 ? "" : "s"} scheduled successfully!`,
    });
  } catch (err: any) {
    console.error("Batch blog schedule error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to schedule blogs" },
      { status: 500 }
    );
  }
}
