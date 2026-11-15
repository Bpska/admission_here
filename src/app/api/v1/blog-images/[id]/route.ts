import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkAdminAccess } from "@/lib/auth/staff-guard";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return new NextResponse(null, { status: 404 });
  const image = await db.blogImage.findUnique({ where: { id }, select: { mimeType: true, size: true, uploaderId: true } });
  if (!image) return new NextResponse(null, { status: 404 });
  const publicPost = await db.blogPost.findFirst({ where: { status: "PUBLISHED", contentMdx: { contains: `/api/v1/blog-images/${id}` } }, select: { id: true } });
  if (!publicPost) {
    const access = await checkAdminAccess("blogs");
    if (!access.allowed || (!access.isSuperAdmin && image.uploaderId !== access.userId)) return new NextResponse(null, { status: 404 });
  }
  const stored = await db.blogImage.findUnique({ where: { id }, select: { data: true } });
  if (!stored) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(stored.data), { headers: { "Content-Type": image.mimeType, "Content-Length": String(image.size), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
