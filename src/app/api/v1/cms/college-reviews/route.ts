import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkAdminAccess, canAccessCollege } from "@/lib/auth/staff-guard";

export async function GET(request: Request) {
  const access = await checkAdminAccess("reviews");
  if (!access.allowed) return NextResponse.json({ error: "Review moderation permission is required." }, { status: 403 });
  const collegeId = new URL(request.url).searchParams.get("collegeId");
  if (!z.string().uuid().safeParse(collegeId).success) return NextResponse.json({ error: "Select a college." }, { status: 400 });
  if (!canAccessCollege(access, collegeId!)) return NextResponse.json({ error: "College is not assigned to you." }, { status: 403 });
  const reviews = await db.review.findMany({ where: { collegeId: collegeId! }, orderBy: { createdAt: "desc" }, include: { college: { select: { name: true, slug: true } }, user: { select: { name: true, email: true } } } });
  return NextResponse.json({ reviews });
}
