import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkAdminAccess } from "@/lib/auth/staff-guard";
import { NAVBAR_FILTERS } from "@/lib/navbar-filters";
import { getCustomNavbarFilters, saveCustomNavbarFilter } from "@/lib/custom-navbar-filters";

export async function GET() {
  const access = await checkAdminAccess("colleges");
  if (!access.allowed) return NextResponse.json({ error: "College access required." }, { status: 403 });
  return NextResponse.json({ filters: [...NAVBAR_FILTERS, ...await getCustomNavbarFilters()] });
}
export async function POST(request: Request) {
  const access = await checkAdminAccess("colleges");
  if (!access.allowed) return NextResponse.json({ error: "College access required." }, { status: 403 });
  try {
    const input = await request.json();
    const filter = await db.$transaction(tx => saveCustomNavbarFilter(tx, input));
    return NextResponse.json({ filter });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "Unable to save section." }, { status: 400 });
  }
}
