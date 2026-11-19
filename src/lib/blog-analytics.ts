import { canonicalBlogHref } from "./blog-destination";
import { Prisma } from "@prisma/client";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

export const BLOG_VISITOR_COOKIE = "admissionhere_blog_visitor";
export const BLOG_VISITOR_MAX_AGE = 365 * 24 * 60 * 60;
export type BlogStats = { views: number; visitors: number };
export const EMPTY_BLOG_STATS: BlogStats = { views: 0, visitors: 0 };
const cookieSecret = () => process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "admission-here-anonymous-analytics";
const signature = (id: string) => createHmac("sha256", cookieSecret()).update(id).digest("hex");
export function blogVisitorIdentity(cookie?: string) {
  const [candidate, signed] = (cookie || "").split(".");
  let id = "";
  if (/^[a-f0-9-]{36}$/i.test(candidate || "") && /^[a-f0-9]{64}$/i.test(signed || "")) {
    if (timingSafeEqual(Buffer.from(signed, "hex"), Buffer.from(signature(candidate), "hex"))) id = candidate;
  }
  if (!id) id = randomUUID();
  return { cookie: `${id}.${signature(id)}`, visitorHash: createHash("sha256").update(id).digest("hex") };
}
export function shouldIgnoreBlogVisit(userAgent: string, role?: string) {
  return ["SUPER_ADMIN", "STAFF", "AUTHOR", "COLLEGE_ADMIN"].includes(role || "") || /bot\b|crawler|spider|headless|lighthouse|pagespeed|preview|facebookexternalhit/i.test(userAgent);
}
export async function getPostBlogStats(blogId: string, client: Prisma.TransactionClient = db): Promise<BlogStats> {
  const result = await client.blogVisit.aggregate({ where: { blogId }, _sum: { viewCount: true }, _count: { _all: true } });
  return { views: result._sum.viewCount || 0, visitors: result._count._all };
}
export async function getBlogStats(postIds: string[], client: Prisma.TransactionClient = db) {
  if (!postIds.length) return { perPost: {} as Record<string, BlogStats>, ...EMPTY_BLOG_STATS };
  const [rows, totals] = await Promise.all([
    client.blogVisit.groupBy({ by: ["blogId"], where: { blogId: { in: postIds } }, _sum: { viewCount: true }, _count: { _all: true } }),
    client.$queryRaw<{ views: bigint; visitors: bigint }[]>(Prisma.sql`SELECT COALESCE(SUM("viewCount"), 0)::bigint AS views, COUNT(DISTINCT "visitorHash")::bigint AS visitors FROM "BlogVisit" WHERE "blogId" IN (${Prisma.join(postIds.map(id => Prisma.sql`${id}::uuid`))})`),
  ]);
  const perPost = Object.fromEntries(rows.map(row => [row.blogId, { views: row._sum.viewCount || 0, visitors: row._count._all }]));
  return { perPost, views: Number(totals[0].views), visitors: Number(totals[0].visitors) };
}
export const BLOG_ACTIVE_VIEW_MS = 45_000;
export function createBlogViewTicket(blogId: string, visitorHash: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ visitId: randomUUID(), blogId, visitorHash, startedAt: now })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export function verifyBlogViewTicket(ticket: string, blogId: string, now = Date.now()) {
  const parts = ticket.split(".");
  if (parts.length !== 2 || !/^[a-f0-9]{64}$/i.test(parts[1])) return null;
  if (!timingSafeEqual(Buffer.from(parts[1], "hex"), Buffer.from(signature(parts[0]), "hex"))) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], "base64url").toString()) as { visitId: string; blogId: string; visitorHash: string; startedAt: number };
    const elapsed = now - data.startedAt;
    if (data.blogId !== blogId || !/^[a-f0-9-]{36}$/i.test(data.visitId) || !/^[a-f0-9]{64}$/i.test(data.visitorHash) || !Number.isFinite(data.startedAt) || elapsed < BLOG_ACTIVE_VIEW_MS || elapsed > 86_400_000) return null;
    return data;
  } catch { return null; }
}
export async function recordBlogView(blogId: string, visitorHash: string, visitId: string, client: Prisma.TransactionClient = db) {
  const post = await client.blogPost.findUnique({ where: { id: blogId }, select: { status: true, slug: true, showOnWebsiteBlog: true, contentMdx: true, relatedCollegeId: true } });
  if (!post || post.status !== "PUBLISHED") return null;
  if (!post.showOnWebsiteBlog && !await canonicalBlogHref(post, client)) return null;
  // One accepted event per page visit. The CTE and aggregate increment are atomic,
  // so retries cannot inflate views. Later visits from this browser count again.
  const changed = await client.$queryRaw<{ blogId: string }[]>(Prisma.sql`
    WITH accepted AS (
      INSERT INTO "BlogQualifiedView" ("id", "blogId", "visitorHash", "createdAt")
      SELECT ${visitId}::uuid, "id", ${visitorHash}, CURRENT_TIMESTAMP FROM "BlogPost"
      WHERE "id" = ${blogId}::uuid AND "status" = 'PUBLISHED'
      ON CONFLICT ("id") DO NOTHING RETURNING "blogId", "visitorHash", "createdAt"
    )
    INSERT INTO "BlogVisit" ("blogId", "visitorHash", "viewCount", "firstSeenAt", "lastViewAt")
    SELECT "blogId", "visitorHash", 1, "createdAt", "createdAt" FROM accepted
    ON CONFLICT ("blogId", "visitorHash") DO UPDATE
      SET "viewCount" = "BlogVisit"."viewCount" + 1, "lastViewAt" = EXCLUDED."lastViewAt"
    RETURNING "blogId"
  `);
  return { ...await getPostBlogStats(blogId, client), counted: changed.length > 0 };
}
