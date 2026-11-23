import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import {
  BLOG_VISITOR_COOKIE,
  BLOG_VISITOR_MAX_AGE,
  blogVisitorIdentity,
  createBlogViewTicket,
  verifyBlogViewTicket,
  recordBlogView,
  shouldIgnoreBlogVisit,
} from "@/lib/blog-analytics";
import { publicEngagementPost } from "@/lib/blog-engagement";
import { isSameSiteRequest } from "@/lib/security";

export const runtime = "nodejs";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({
    action: z.literal("complete"),
    ticket: z.string().max(2000),
    activeMs: z.number().finite().min(45000).max(86400000),
  }),
]);
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  try {
    if (!isSameSiteRequest(request))
      return NextResponse.json(
        { error: "Same-site requests only." },
        { status: 403 },
      );
  } catch {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "A view requires 45 active seconds." },
      { status: 400 },
    );
  try {
    const session = await auth();
    if (
      shouldIgnoreBlogVisit(
        request.headers.get("user-agent") || "",
        (session?.user as { role?: string } | undefined)?.role,
      )
    )
      return new NextResponse(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
    if (parsed.data.action === "start") {
      if (!(await publicEngagementPost(id)))
        return NextResponse.json(
          { error: "Article not found." },
          { status: 404 },
        );
      const visitor = blogVisitorIdentity(
        request.cookies.get(BLOG_VISITOR_COOKIE)?.value,
      );
      const response = NextResponse.json(
        { ticket: createBlogViewTicket(id, visitor.visitorHash) },
        { headers: { "Cache-Control": "no-store" } },
      );
      response.cookies.set(BLOG_VISITOR_COOKIE, visitor.cookie, {
        httpOnly: true,
        sameSite: "lax",
        secure:
          request.nextUrl.protocol === "https:" ||
          request.headers.get("x-forwarded-proto") === "https",
        maxAge: BLOG_VISITOR_MAX_AGE,
        path: "/",
      });
      return response;
    }
    const visit = verifyBlogViewTicket(parsed.data.ticket, id);
    if (!visit)
      return NextResponse.json(
        {
          error: "The visit has not qualified or has expired.",
          code: "BLOG_VIEW_TICKET_INVALID",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    const stats = await recordBlogView(id, visit.visitorHash, visit.visitId);
    return NextResponse.json(stats || { error: "Article not found." }, {
      status: stats ? 200 : 404,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[blog-views] Unable to record article view", error);
    return NextResponse.json(
      {
        error: "Unable to record article view. Please retry.",
        code: "BLOG_VIEW_UNAVAILABLE",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "5" },
      },
    );
  }
}
