import { Prisma } from "@prisma/client";
import { db } from "./db";
import { canonicalBlogHref } from "./blog-destination";
export async function publicEngagementPost(id: string, client: Prisma.TransactionClient = db) {
  const post = await client.blogPost.findUnique({ where: { id, status: "PUBLISHED" } });
  return post && await canonicalBlogHref(post, client) ? post : null;
}
export async function blogEngagement(id: string, visitorHash: string, client: Prisma.TransactionClient = db) {
  const post = await publicEngagementPost(id, client);
  if (!post) return null;
  const [likes, liked, commentCount, comments] = await Promise.all([
    client.blogLike.count({ where: { blogId: id } }),
    client.blogLike.findUnique({ where: { blogId_visitorHash: { blogId: id, visitorHash } } }),
    client.blogComment.count({ where: { blogId: id, status: "APPROVED" } }),
    post.commentsEnabled ? client.blogComment.findMany({ where: { blogId: id, status: "APPROVED" }, select: { id: true, name: true, body: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 }) : [],
  ]);
  return { likesEnabled: post.likesEnabled, commentsEnabled: post.commentsEnabled, likes, liked: !!liked, commentCount, comments };
}
export async function setBlogLike(id: string, visitorHash: string, liked: boolean) {
  return db.$transaction(async tx => {
    const post = await publicEngagementPost(id, tx);
    if (!post) return "NOT_FOUND";
    if (!post.likesEnabled) return "DISABLED";
    if (liked) await tx.blogLike.upsert({ where: { blogId_visitorHash: { blogId: id, visitorHash } }, create: { blogId: id, visitorHash }, update: {} });
    else await tx.blogLike.deleteMany({ where: { blogId: id, visitorHash } });
    return "OK";
  });
}
export async function submitBlogComment(id: string, visitorHash: string, name: string, body: string) {
  return db.$transaction(async tx => {
    // Serialize submissions from this browser so concurrent requests share the limit.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${visitorHash}, 0))::text`;
    const post = await publicEngagementPost(id, tx);
    if (!post) return "NOT_FOUND";
    if (!post.commentsEnabled) return "DISABLED";
    const recent = await tx.blogComment.count({ where: { visitorHash, createdAt: { gte: new Date(Date.now() - 3600000) } } });
    if (recent >= 5) return "RATE_LIMIT";
    await tx.blogComment.create({ data: { blogId: id, visitorHash, name, body, status: "APPROVED" } });
    return "OK";
  });
}
