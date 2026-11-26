import { validateBlogDestination } from "@/lib/blog-destination";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PostStatus, BlogCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { validateBlogImages } from "@/lib/blog-images";

const BlogPatchSchema = z.object({
  title: z.string().min(3).optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  featuredImageUrl: z.string().optional(),
  category: z.nativeEnum(BlogCategory).optional(),
  tags: z.array(z.string()).optional(),
  tldrSummary: z.array(z.string()).optional(),
  contentMdx: z.string().min(10).optional(),
  showOnWebsiteBlog: z.boolean().optional(),
  isLiveBlog: z.boolean().optional(),
  liveUpdatesJson: z.array(z.object({ id: z.string(), timestamp: z.string().datetime(), headline: z.string().min(1), bodyHtml: z.string(), isPinned: z.boolean().default(false) })).optional(),
  status: z.nativeEnum(PostStatus).optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  authorId: z.string().uuid().optional(),
  relatedCollegeId: z.string().uuid().nullable().optional(),
});

async function getSessionUser() {
  const session = await auth();
  return session?.user as any;
}

function hasPermission(user: any, permission: string) {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN") return true;
  if (user.role !== "STAFF" && user.role !== "AUTHOR") return false;
  const perms: string[] = user.permissions || [];
  return perms.includes(permission);
}

/** PATCH — partial update of a blog post */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser();

    if (!hasPermission(user, "blogs")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch existing post for ownership check
    const existing = await db.blogPost.findUnique({
      where: { id },
      select: { authorId: true, slug: true, contentMdx: true, featuredImageUrl: true, showOnWebsiteBlog: true, status: true, relatedCollegeId: true, publishedAt: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Blog post not found" }, { status: 404 });
    }

    // STAFF can only edit own posts
    if ((user.role === "STAFF" || user.role === "AUTHOR") && existing.authorId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: you can only edit your own posts" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = BlogPatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.format() },
        { status: 400 }
      );
    }

    if (parsed.data.contentMdx !== undefined || parsed.data.featuredImageUrl !== undefined) {
      const imageError = await validateBlogImages(`${parsed.data.contentMdx ?? existing.contentMdx} ${parsed.data.featuredImageUrl ?? existing.featuredImageUrl ?? ""}`, user, `${existing.contentMdx} ${existing.featuredImageUrl || ""}`);
      if (imageError) return NextResponse.json({ error: imageError }, { status: 400 });
    }

    if (parsed.data.relatedCollegeId && !await db.college.findUnique({ where: { id: parsed.data.relatedCollegeId, isPublished: true }, select: { id: true } })) {
      return NextResponse.json({ error: "Choose a published college." }, { status: 400 });
    }
    const nextStatus = parsed.data.status ?? existing.status;
    const destinationError = await validateBlogDestination({ showOnWebsiteBlog: parsed.data.showOnWebsiteBlog ?? existing.showOnWebsiteBlog, contentMdx: parsed.data.contentMdx ?? existing.contentMdx, relatedCollegeId: parsed.data.relatedCollegeId !== undefined ? parsed.data.relatedCollegeId : existing.relatedCollegeId }, nextStatus === "PUBLISHED" || nextStatus === "SCHEDULED");
    if (destinationError) return NextResponse.json({ error: destinationError }, { status: 400 });
    const updateData: any = { ...parsed.data };

    // Only SUPER_ADMIN can change author
    if (user.role !== "SUPER_ADMIN") {
      delete updateData.authorId;
    }

    // Permission to publish or schedule
    const canPublish =
      user.role === "SUPER_ADMIN" ||
      (user.permissions || []).includes("blogs:publish") ||
      (user.permissions || []).includes("blogs");

    if (
      (updateData.status === PostStatus.PUBLISHED || updateData.status === PostStatus.SCHEDULED) &&
      !canPublish
    ) {
      updateData.status = PostStatus.DRAFT;
      delete updateData.publishedAt;
    }

    if (updateData.publishedAt !== undefined) {
      updateData.publishedAt = updateData.publishedAt ? new Date(updateData.publishedAt) : null;
    }

    if (updateData.status === PostStatus.SCHEDULED) {
      const targetDate = updateData.publishedAt instanceof Date ? updateData.publishedAt : existing.publishedAt;
      if (!targetDate) {
        return NextResponse.json({ error: "Select a schedule date and time." }, { status: 400 });
      }
      if (targetDate.getTime() <= Date.now()) {
        updateData.status = PostStatus.PUBLISHED;
      }
      updateData.publishedAt = targetDate;
    } else if (updateData.status === PostStatus.PUBLISHED) {
      updateData.publishedAt = (updateData.publishedAt instanceof Date ? updateData.publishedAt : null) || existing.publishedAt || new Date();
    } else if (updateData.status === PostStatus.DRAFT && existing.status === PostStatus.SCHEDULED && updateData.publishedAt === undefined) {
      updateData.publishedAt = null;
    }

    const post = await db.blogPost.update({ where: { id }, data: updateData });

    try {
      revalidatePath("/", "layout");
      revalidatePath("/blog");
      revalidatePath(`/blog/${post.slug}`);
    } catch {
      /* ignore */
    }

    return NextResponse.json({ success: true, post });
  } catch (err: any) {
    console.error("Blog PATCH error:", err);
    return NextResponse.json({ error: err.message || "Failed to update post" }, { status: 500 });
  }
}

/** DELETE — remove a blog post */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser();

    if (!hasPermission(user, "blogs")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await db.blogPost.findUnique({
      where: { id },
      select: { authorId: true, slug: true, contentMdx: true, featuredImageUrl: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Blog post not found" }, { status: 404 });
    }

    // STAFF: only delete own posts; also need blogs:delete sub-permission
    if ((user.role === "STAFF" || user.role === "AUTHOR")) {
      const perms: string[] = user.permissions || [];
      if (existing.authorId !== user.id) {
        return NextResponse.json(
          { error: "Forbidden: you can only delete your own posts" },
          { status: 403 }
        );
      }
      if (!perms.includes("blogs:delete") && !perms.includes("blogs")) {
        return NextResponse.json(
          { error: "Forbidden: blogs:delete permission required" },
          { status: 403 }
        );
      }
    }

    await db.blogPost.delete({ where: { id } });

    try {
      revalidatePath("/", "layout");
      revalidatePath("/blog");
      revalidatePath(`/blog/${existing.slug}`);
    } catch {
      /* ignore */
    }

    return NextResponse.json({ success: true, message: "Blog post deleted." });
  } catch (err: any) {
    console.error("Blog DELETE error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete post" }, { status: 500 });
  }
}

