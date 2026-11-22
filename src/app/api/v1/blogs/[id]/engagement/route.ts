import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BLOG_VISITOR_MAX_AGE, blogVisitorIdentity } from "@/lib/blog-analytics";
import { blogEngagement, setBlogLike, submitBlogComment } from "@/lib/blog-engagement";
import { isSameSiteRequest } from "@/lib/security";
export const runtime = "nodejs";
const ENGAGEMENT_COOKIE = "admissionhere_blog_interactions";
const schema = z.discriminatedUnion("action", [z.object({ action: z.literal("like"), liked: z.boolean() }), z.object({ action: z.literal("comment"), name: z.string().trim().min(2).max(80), body: z.string().trim().min(2).max(2000) })]);
type Context = { params: Promise<{ id: string }> };
function reply(request: NextRequest, visitor: ReturnType<typeof blogVisitorIdentity>, data: unknown, status = 200) {
  const response = NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
  response.cookies.set(ENGAGEMENT_COOKIE, visitor.cookie, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https", maxAge: BLOG_VISITOR_MAX_AGE, path: "/" });
  return response;
}
export async function GET(request: NextRequest, { params }: Context) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Article not found." }, { status: 404 });
  const visitor = blogVisitorIdentity(request.cookies.get(ENGAGEMENT_COOKIE)?.value);
  const engagement = await blogEngagement(id, visitor.visitorHash);
  return reply(request, visitor, engagement || { error: "Article not found." }, engagement ? 200 : 404);
}
export async function POST(request: NextRequest, { params }: Context) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Article not found." }, { status: 404 });
  try {
    if (!isSameSiteRequest(request)) return NextResponse.json({ error: "Same-site requests only." }, { status: 403 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter your name (2–80 characters) and comment (2–2000 characters)." }, { status: 400 });
    const visitor = blogVisitorIdentity(request.cookies.get(ENGAGEMENT_COOKIE)?.value);
    const data = parsed.data;
    const result = data.action === "like" ? await setBlogLike(id, visitor.visitorHash, data.liked) : await submitBlogComment(id, visitor.visitorHash, data.name, data.body);
    if (result !== "OK") return reply(request, visitor, { error: result === "NOT_FOUND" ? "Article not found." : result === "RATE_LIMIT" ? "You can submit up to 5 comments per hour. Please try again later." : "This feature has been disabled by the admin." }, result === "NOT_FOUND" ? 404 : result === "RATE_LIMIT" ? 429 : 403);
    return reply(request, visitor, await blogEngagement(id, visitor.visitorHash));
  } catch { return NextResponse.json({ error: "Unable to save. Please try again." }, { status: 400 }); }
}
