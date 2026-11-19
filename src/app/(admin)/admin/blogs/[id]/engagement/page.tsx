import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { checkAdminAccess } from "@/lib/auth/staff-guard";
import { BlogEngagementManager } from "@/components/admin/BlogEngagementManager";
export const dynamic = "force-dynamic";
export default async function EngagementPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await checkAdminAccess("blogs"); if (!access.allowed) notFound();
  const { id } = await params;
  const post = await db.blogPost.findUnique({ where: { id }, include: { _count: { select: { likes: true } } } });
  if (!post || (!access.isSuperAdmin && post.authorId !== access.userId)) notFound();
  const statuses = ["PENDING", "APPROVED", "REJECTED"];
  const [groups, ...commentGroups] = await Promise.all([
    db.blogComment.groupBy({ by: ["status"], where: { blogId: id }, _count: { _all: true } }),
    ...statuses.map(status => db.blogComment.findMany({ where: { blogId: id, status }, select: { id: true, name: true, body: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 200 })),
  ]);
  return <div className="max-w-5xl space-y-6"><Link href={`/admin/${access.isSuperAdmin ? "blogs" : "staff-blogs"}/${post.showOnWebsiteBlog ? "website" : "college"}`} className="text-sm text-primary underline">← Back to blogs</Link><div><h1 className="text-2xl font-bold">Likes &amp; comments</h1><p className="mt-1 text-muted-foreground">{post.title}</p></div><BlogEngagementManager blogId={id} likesEnabled={post.likesEnabled} commentsEnabled={post.commentsEnabled} likes={post._count.likes} counts={Object.fromEntries(groups.map(group => [group.status, group._count._all]))} comments={commentGroups.flat().map(comment => ({ ...comment, createdAt: comment.createdAt.toISOString() }))} /></div>;
}
