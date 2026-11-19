import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchSuggestions } from "@/lib/search-suggestions";
export async function GET(request: NextRequest) {
  const parsed = z.object({ q: z.string().trim().max(100), stream: z.enum(["Engineering", "Management", "Medical"]).optional() }).safeParse({ q: request.nextUrl.searchParams.get("q") || "", stream: request.nextUrl.searchParams.get("stream") || undefined });
  if (!parsed.success) return NextResponse.json({ error: "Invalid search query." }, { status: 400 });
  try { return NextResponse.json({ data: await searchSuggestions(parsed.data.q, parsed.data.stream) }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Suggestions are temporarily unavailable." }, { status: 503 }); }
}
