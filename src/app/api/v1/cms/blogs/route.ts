import { randomUUID } from "node:crypto";
import { validateBlogDestination } from "@/lib/blog-destination";
import { getBlogStats } from "@/lib/blog-analytics";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { PostStatus, BlogCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { validateBlogImages } from "@/lib/blog-images";

const BlogSaveSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(3),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  featuredImageUrl: z.string().refine(value => !value || /^\/api\/v1\/blog-images\/[a-f0-9-]{36}$/i.test(value) || z.string().url().safeParse(value).success, "Invalid featured image").optional(),
  category: z.nativeEnum(BlogCategory).default(BlogCategory.CUTOFF_ANALYSIS),
  tags: z.array(z.string()).default([]),
  tldrSummary: z.array(z.string()).default([]),
  contentMdx: z.string().min(10),
  faqsJson: z.array(z.object({ question: z.string().trim().min(1), answer: z.string().trim().min(1) })).max(50).optional(),
  isLiveBlog: z.boolean().default(false),
  liveUpdatesJson: z.array(z.object({ id: z.string(), timestamp: z.string().datetime(), headline: z.string().min(1), bodyHtml: z.string(), isPinned: z.boolean().default(false) })).default([]),
  likesEnabled: z.boolean().optional(),
  commentsEnabled: z.boolean().optional(),
  showOnWebsiteBlog: z.boolean().optional(),
  publish: z.boolean().default(false),
  authorId: z.string().uuid().optional(), // Admin can override author
  relatedCollegeId: z.string().uuid().nullable().optional(),
});

/** GET — list blogs. SUPER_ADMIN sees all; STAFF sees own. */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user as any;
    const role = user?.role;
    const permissions: string[] = user?.permissions || [];

    // Must be SUPER_ADMIN or STAFF with blogs permission
    if (role !== "SUPER_ADMIN" && !((role === "STAFF" || role === "AUTHOR") && permissions.includes("blogs"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const where =
      (role === "STAFF" || role === "AUTHOR")
        ? { authorId: user.id }
        : undefined;

    const posts = await db.blogPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { name: true, id: true } },
        _count: { select: { generatedLeads: true } },
      },
    });

    const analytics = await getBlogStats(posts.map(post => post.id));
    return NextResponse.json({ success: true, posts: posts.map(post => ({ ...post, viewCount: analytics.perPost[post.id]?.views || 0, uniqueVisitors: analytics.perPost[post.id]?.visitors || 0 })), analytics: { views: analytics.views, visitors: analytics.visitors } });
  } catch (err: any) {
    console.error("Blog GET error:", err);
    return NextResponse.json({ error: "Failed to fetch blogs" }, { status: 500 });
  }
}

/** POST — create or update a blog post. */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user as any;
    const role = user?.role;
    const permissions: string[] = user?.permissions || [];

    // Auth guard
    if (role !== "SUPER_ADMIN" && !((role === "STAFF" || role === "AUTHOR") && permissions.includes("blogs"))) {
      return NextResponse.json({ error: "Unauthorized: blogs permission required" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = BlogSaveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid blog data", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      id,
      title,
      metaTitle,
      metaDescription,
      featuredImageUrl,
      category,
      tags,
      tldrSummary,
      contentMdx,
      faqsJson,
      isLiveBlog,
      liveUpdatesJson,
      publish,
      showOnWebsiteBlog,
      likesEnabled,
      commentsEnabled,
      relatedCollegeId,
      authorId: overrideAuthorId,
    } = parsed.data;

    // Determine publish permission:
    // SUPER_ADMIN can always publish.
    // STAFF: publish requires explicit "blogs:publish" sub-permission OR the general "blogs" permission.
    const canPublish =
      role === "SUPER_ADMIN" ||
      permissions.includes("blogs:publish") ||
      permissions.includes("blogs");

    const effectivePublish = publish && canPublish;

    // Slug generation
    let slug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80).replace(/^-+|-+$/g, "") || "article";
    if (!id && await db.blogPost.findUnique({ where: { slug }, select: { id: true } })) slug = `${slug}-${randomUUID().slice(0, 8)}`;

    // Determine authorId
    let resolvedAuthorId: string;
    if (role === "SUPER_ADMIN" && overrideAuthorId) {
      resolvedAuthorId = overrideAuthorId;
    } else if (user?.id) {
      resolvedAuthorId = user.id;
    } else {
      // Fallback for dev without session
      const fallbackAuthor =
        (await db.user.findFirst({ where: { role: { in: ["AUTHOR", "SUPER_ADMIN"] } } })) ||
        (await db.user.findFirst());
      if (!fallbackAuthor) {
        return NextResponse.json({ error: "No author account found in database" }, { status: 500 });
      }
      resolvedAuthorId = fallbackAuthor.id;
    }

    let previousContent = "";
    if (id) {
      const previous = await db.blogPost.findUnique({ where: { id }, select: { contentMdx: true, featuredImageUrl: true } });
      previousContent = `${previous?.contentMdx || ""} ${previous?.featuredImageUrl || ""}`;
    }

    // If STAFF is editing, verify they own the post
    if (id && (role === "STAFF" || role === "AUTHOR")) {
      const existing = await db.blogPost.findUnique({ where: { id }, select: { authorId: true } });
      if (!existing) {
        return NextResponse.json({ error: "Blog post not found" }, { status: 404 });
      }
      if (existing.authorId !== user.id) {
        return NextResponse.json(
          { error: "Forbidden: you can only edit your own blog posts" },
          { status: 403 }
        );
      }
    }

    const imageError = await validateBlogImages(`${contentMdx} ${featuredImageUrl || ""}`, user, previousContent);
    if (imageError) return NextResponse.json({ error: imageError }, { status: 400 });

    if (relatedCollegeId && !await db.college.findUnique({ where: { id: relatedCollegeId, isPublished: true }, select: { id: true } })) {
      return NextResponse.json({ error: "Choose a published college." }, { status: 400 });
    }

    const previousPlacement = id ? await db.blogPost.findUnique({ where: { id }, select: { showOnWebsiteBlog: true, relatedCollegeId: true, publishedAt: true } }) : null;
    const destinationError = await validateBlogDestination({ showOnWebsiteBlog: showOnWebsiteBlog ?? previousPlacement?.showOnWebsiteBlog ?? true, contentMdx, relatedCollegeId: relatedCollegeId !== undefined ? relatedCollegeId : previousPlacement?.relatedCollegeId }, effectivePublish);
    if (destinationError) return NextResponse.json({ error: destinationError }, { status: 400 });

    // Generate embedding if publishing
    let embedding: any = null;
    if (effectivePublish) {
      const text = `${title} ${metaDescription || ""} ${tldrSummary.join(" ")}`;
      embedding = await generateEmbedding(text);
    }

    let post;
    const postData = {
      ...(likesEnabled !== undefined ? { likesEnabled } : {}),
      ...(commentsEnabled !== undefined ? { commentsEnabled } : {}),
      ...(showOnWebsiteBlog !== undefined ? { showOnWebsiteBlog } : {}),
      ...(faqsJson !== undefined ? { faqsJson } : {}),
      title,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
      featuredImageUrl: featuredImageUrl || null,
      category,
      tags,
      tldrSummary,
      contentMdx,
      isLiveBlog,
      liveUpdatesJson,
      ...(relatedCollegeId !== undefined ? { relatedCollegeId } : {}),
      status: effectivePublish ? PostStatus.PUBLISHED : PostStatus.DRAFT,
      publishedAt: effectivePublish ? previousPlacement?.publishedAt || new Date() : undefined,
    };

    if (id) {
      post = await db.blogPost.update({ where: { id }, data: postData });
    } else {
      post = await db.blogPost.create({
        data: {
          slug,
          ...postData,
          publishedAt: effectivePublish ? new Date() : null,
          authorId: resolvedAuthorId,
        },
      });
    }

    // Store vector embedding
    if (effectivePublish && embedding) {
      try {
        await db.blogPost.update({ where: { id: post.id }, data: { embedding } });
      } catch (embErr) {
        console.warn("Vector embedding storage note:", embErr);
      }
    }

    // Revalidate public caches
    try {
      revalidatePath("/", "layout");
      revalidatePath("/blog");
      revalidatePath(`/blog/${post.slug}`);
      revalidatePath("/sitemap.xml");
      revalidatePath("/llms.txt");
    } catch (e) {
      console.warn("Revalidation warning:", e);
    }

    return NextResponse.json({
      success: true,
      post,
      message: effectivePublish
        ? "Article published and indexed!"
        : publish && !canPublish
        ? "Draft saved. You don't have publish permission — ask the admin to publish."
        : "Draft saved successfully.",
    });
  } catch (err: any) {
    console.error("CMS blog save error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save blog post" },
      { status: 500 }
    );
  }
}
