import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { blogAccountIdentity, blogEngagement, setBlogLike, submitBlogComment } from "@/lib/blog-engagement";
import { isSameSiteRequest } from "@/lib/security";
export const runtime = "nodejs";
const schema = z.discriminatedUnion("action", [z.object({ action: z.literal("like"), liked: z.boolean() }), z.object({ action: z.literal("comment"), body: z.string().trim().min(2).max(2000) })]);
type Context = { params: Promise<{ id: string }> };
function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return reply({ error: "Article not found." }, 404);
  const session = await auth();
  const user = session?.user;
  const engagement = await blogEngagement(id, user?.id ? blogAccountIdentity(user.id) : "");
  return reply(engagement ? { ...engagement, viewer: user?.id ? { name: user.name || "Reader" } : null } : { error: "Article not found." }, engagement ? 200 : 404);
}
export async function POST(request: NextRequest, { params }: Context) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return reply({ error: "Article not found." }, 404);
  try {
    if (!isSameSiteRequest(request)) return reply({ error: "Same-site requests only." }, 403);
    const session = await auth();
    const user = session?.user;
    if (!user?.id) return reply({ error: "Sign in to like articles or post comments." }, 401);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return reply({ error: "Enter a comment between 2 and 2000 characters." }, 400);
    const identity = blogAccountIdentity(user.id);
    const name = user.name?.trim().slice(0, 80) || "Reader";
    const data = parsed.data;
    const result = data.action === "like" ? await setBlogLike(id, identity, data.liked) : await submitBlogComment(id, identity, name, data.body);
    if (result !== "OK") return reply({ error: result === "NOT_FOUND" ? "Article not found." : result === "RATE_LIMIT" ? "You can submit up to 5 comments per hour. Please try again later." : "This feature has been disabled by the admin." }, result === "NOT_FOUND" ? 404 : result === "RATE_LIMIT" ? 429 : 403);
    return reply({ ...await blogEngagement(id, identity), viewer: { name: user.name || "Reader" } });
  } catch { return reply({ error: "Unable to save. Please try again." }, 400); }
}
