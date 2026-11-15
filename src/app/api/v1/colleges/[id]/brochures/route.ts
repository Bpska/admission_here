import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { resolveCollegeBrochures } from "@/lib/brochures";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid college ID" }, { status: 400 });
  }
  try {
    const college = await db.college.findUnique({ where: { id, isPublished: true }, select: { id: true, slug: true, websiteUrl: true, brochurePdfUrl: true, courses: { select: { course: { select: { degree: true } } } } } });
    if (!college) return NextResponse.json({ error: "College not found" }, { status: 404 });
    return NextResponse.json({ brochures: resolveCollegeBrochures(college), websiteUrl: college.websiteUrl });
  } catch {
    return NextResponse.json({ error: "Unable to load brochures. Please try again." }, { status: 500 });
  }
}
