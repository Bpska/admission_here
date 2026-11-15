import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const college = await db.college.findUnique({ where: { slug, isPublished: true }, select: { id: true, slug: true, name: true, city: true, state: true, nirfRank: true, ratingOverall: true, logoUrl: true } });
  return college ? NextResponse.json({ college }) : NextResponse.json({ error: "College not found" }, { status: 404 });
}
