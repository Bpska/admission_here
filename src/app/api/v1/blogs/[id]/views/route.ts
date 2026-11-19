import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { BLOG_VISITOR_COOKIE, BLOG_VISITOR_MAX_AGE, blogVisitorIdentity, createBlogViewTicket, verifyBlogViewTicket, recordBlogView, shouldIgnoreBlogVisit } from "@/lib/blog-analytics";
import { publicEngagementPost } from "@/lib/blog-engagement";

export const runtime = "nodejs";
const schema = z.discriminatedUnion("action", [z.object({ action: z.literal("start") }), z.object({ action: z.literal("complete"), ticket: z.string().max(2000), activeMs: z.number().finite().min(45000).max(86400000) })]);
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Article not found." }, { status: 404 });
  try {
    const origin = request.headers.get("origin");
    if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && new URL(origin).host !== (request.headers.get("host") || request.nextUrl.host))) return NextResponse.json({ error: "Same-site requests only." }, { status: 403 });
  } catch { return NextResponse.json({ error: "Invalid request origin." }, { status: 403 }); }
  const session = await auth();
  if (shouldIgnoreBlogVisit(request.headers.get("user-agent") || "", (session?.user as { role?: string } | undefined)?.role)) return new NextResponse(null, { status: 204 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A view requires 45 active seconds." }, { status: 400 });
  try {
    if (parsed.data.action === "start") {
      if (!await publicEngagementPost(id)) return NextResponse.json({ error: "Article not found." }, { status: 404 });
      const visitor = blogVisitorIdentity(request.cookies.get(BLOG_VISITOR_COOKIE)?.value);
      const response = NextResponse.json({ ticket: createBlogViewTicket(id, visitor.visitorHash) }, { headers: { "Cache-Control": "no-store" } });
      response.cookies.set(BLOG_VISITOR_COOKIE, visitor.cookie, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https", maxAge: BLOG_VISITOR_MAX_AGE, path: "/" });
      return response;
    }
    const visit = verifyBlogViewTicket(parsed.data.ticket, id);
    if (!visit) return NextResponse.json({ error: "The visit has not qualified or has expired." }, { status: 400 });
    const stats = await recordBlogView(id, visit.visitorHash, visit.visitId);
    return NextResponse.json(stats || { error: "Article not found." }, { status: stats ? 200 : 404, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Unable to record article view." }, { status: 503 }); }
}
