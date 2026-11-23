import { getPostBlogStats } from "@/lib/blog-analytics";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { EditBlogClient } from "./EditBlogClient";
import { checkAdminAccess } from "@/lib/auth/staff-guard";
import { canonicalBlogHref } from "@/lib/blog-destination";

interface EditBlogPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBlogPage({ params }: EditBlogPageProps) {
  const access = await checkAdminAccess("blogs");
  if (!access.allowed) notFound();
  const { id } = await params;

  const post = await db.blogPost.findUnique({
    where: { id },
    include: { relatedCollege: { select: { slug: true } } },
  });

  if (!post) notFound();
  if (!access.isSuperAdmin && post.authorId !== access.userId) notFound();

  const stats = await getPostBlogStats(post.id);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/blogs/${post.showOnWebsiteBlog ? "website" : "college"}`}
          className="p-2 rounded-lg border hover:bg-accent text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">
            Edit Article: {post.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            Status: <strong className="text-foreground">{post.status}</strong> • Views:{" "}
            {stats.views.toLocaleString("en-IN")} • Unique visitors: {stats.visitors.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <EditBlogClient post={{ ...post, publicPath: await canonicalBlogHref(post) }} canPublish={access.isSuperAdmin || access.permissions.includes("blogs") || access.permissions.includes("blogs:publish")} />
    </div>
  );
}

