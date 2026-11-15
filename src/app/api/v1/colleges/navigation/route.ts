import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { NAVBAR_CATEGORY_VALUES } from "@/lib/navbar-categories";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const colleges = await db.college.findMany({
      where: { isPublished: true, showInNavbar: true, navbarCategory: { in: [...NAVBAR_CATEGORY_VALUES] } },
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true, shortName: true, navbarCategory: true, navbarSection: true },
    });
    return NextResponse.json({ colleges }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load navbar colleges." }, { status: 500 });
  }
}
