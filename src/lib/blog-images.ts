import "server-only";
import { db } from "@/lib/db";

export async function validateBlogImages(content: string, user: { id: string; role: string }, previousContent = "") {
  const ids = [...new Set(Array.from(content.matchAll(/\/api\/v1\/blog-images\/([a-f0-9-]{36})/gi), match => match[1]))];
  if (!ids.length) return null;
  const images = await db.blogImage.findMany({ where: { id: { in: ids } }, select: { id: true, uploaderId: true } });
  if (images.length !== ids.length) return "One of the uploaded pictures is missing. Please upload it again.";
  if (user.role === "SUPER_ADMIN") return null;
  for (const image of images) {
    const path = `/api/v1/blog-images/${image.id}`;
    if (image.uploaderId === user.id || previousContent.includes(path)) continue;
    const published = await db.blogPost.findFirst({ where: { status: "PUBLISHED", contentMdx: { contains: path } }, select: { id: true } });
    if (!published) return "You can only attach your own unpublished pictures.";
  }
  return null;
}
