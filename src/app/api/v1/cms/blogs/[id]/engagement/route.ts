import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkAdminAccess } from "@/lib/auth/staff-guard";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settings"), likesEnabled: z.boolean(), commentsEnabled: z.boolean() }),
  z.object({ action: z.literal("moderate"), commentId: z.string().uuid(), status: z.enum(["PENDING", "APPROVED", "REJECTED"]) }),
  z.object({ action: z.literal("delete"), commentId: z.string().uuid() }),
  z.object({ action: z.literal("clearLikes") }),
]);
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkAdminAccess("blogs");
  if (!access.allowed) return NextResponse.json({ error: "Blog access required." }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Article not found." }, { status: 404 });
  const post = await db.blogPost.findUnique({ where: { id }, select: { authorId: true } });
  if (!post || (!access.isSuperAdmin && post.authorId !== access.userId)) return NextResponse.json({ error: "Article not found." }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid moderation action." }, { status: 400 });
  const data = parsed.data;
  if (data.action === "settings") await db.blogPost.update({ where: { id }, data: { likesEnabled: data.likesEnabled, commentsEnabled: data.commentsEnabled } });
  if (data.action === "clearLikes") await db.blogLike.deleteMany({ where: { blogId: id } });
  if (data.action === "moderate") await db.blogComment.updateMany({ where: { id: data.commentId, blogId: id }, data: { status: data.status } });
  if (data.action === "delete") await db.blogComment.deleteMany({ where: { id: data.commentId, blogId: id } });
  return NextResponse.json({ success: true });
}
