import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { EditBlogClient } from "./EditBlogClient";
import { checkAdminAccess } from "@/lib/auth/staff-guard";

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

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/blogs"
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
            {post.viewCount}
          </p>
        </div>
      </div>

      <EditBlogClient post={post} />
    </div>
  );
}

