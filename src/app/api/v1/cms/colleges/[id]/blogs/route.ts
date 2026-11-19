import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkAdminAccess, canAccessCollege } from "@/lib/auth/staff-guard";
import { getCollegeBlogPosts } from "@/lib/college-blogs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkAdminAccess("colleges");
  if (!access.allowed) return NextResponse.json({ error: "College access required." }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "College not found." }, { status: 404 });
  if (!canAccessCollege(access, id)) return NextResponse.json({ error: "College is not assigned to you." }, { status: 403 });
  const college = await db.college.findUnique({ where: { id }, select: { id: true, slug: true, isPublished: true } });
  if (!college) return NextResponse.json({ error: "College not found." }, { status: 404 });
  const blogs = await checkAdminAccess("blogs");
  const scope = access.isSuperAdmin ? {} : blogs.allowed ? { OR: [{ status: "PUBLISHED" as const }, { authorId: access.userId }] } : { status: "PUBLISHED" as const };
  const posts = await getCollegeBlogPosts(college, { AND: [scope, { showOnWebsiteBlog: false }] });
  return NextResponse.json({ college, canCreate: blogs.allowed && college.isPublished, posts: posts.map(post => ({ id: post.id, slug: post.slug, title: post.title, status: post.status, canEdit: blogs.allowed && (access.isSuperAdmin || post.authorId === access.userId) })) });
}
