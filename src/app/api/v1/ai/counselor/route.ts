import { NextRequest, NextResponse } from "next/server";
import { retrieveCounselingContext, COUNSELOR_SYSTEM_PROMPT } from "@/lib/ai/rag-counselor";
import { z } from "zod";

const CounselorRequestSchema = z.object({
  query: z.string().trim().min(1, "Query is required").max(2000),
  profile: z
    .object({
      studentName: z.string().optional(),
      targetStream: z.string().optional(),
      targetDegree: z.string().optional(),
      entranceExam: z.string().optional(),
      rankOrPercentile: z.number().finite().min(0).max(100000000).optional(),
      category: z.string().optional(),
      homeState: z.string().optional(),
      budgetInr: z.number().finite().positive().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CounselorRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { query, profile } = parsed.data;

    // 1. Retrieve RAG grounded context from PostgreSQL
    const context = await retrieveCounselingContext(query, profile);

    // 2. Structured Counselor Reasoning Engine
    // In production with OpenAI key, Vercel AI SDK or fetch is invoked.
    // Here we also supply an intelligent, context-grounded response.
    const relevantCollegeSummaries = context.colleges
      .map(
        (c) =>
          `• **${c.name}** (${c.city}, ${c.state}) | NIRF Rank: #${c.nirfRank || "Unranked"} | Rating: ${c.rating}/5.0\n` +
          `  Courses: ${c.courses.map((cr) => `${cr.name} (Fees: ${cr.fees == null ? "Not published" : `₹${(cr.fees / 100000).toFixed(2)}L`})`).join(", ")}\n` +
          (c.latestPlacement
            ? `  Placement: Average ${c.latestPlacement.averagePackage == null ? "Not reported" : `₹${(c.latestPlacement.averagePackage / 100000).toFixed(1)} LPA`}, Highest ${c.latestPlacement.highestPackage == null ? "Not reported" : `₹${(c.latestPlacement.highestPackage / 100000).toFixed(1)} LPA`}`
            : "")
      )
      .join("\n\n");

    const answer = `College information for: ${query}\n\n` +
      (context.colleges.length ? relevantCollegeSummaries : "No published colleges match these filters. Try another location, course, or budget.") +
      "\n\nThese are database matches, not confirmed admission offers. Use the college predictor to compare your exam rank or percentile with recorded cutoffs. Home-state eligibility and seat allocation rules depend on the institution and counseling authority. Check the college's current admission document before applying.";

    return NextResponse.json({
      success: true,
      answer,
      groundedCollegesCount: context.colleges.length,
      colleges: context.colleges,
    });
  } catch (error) {
    console.error("AI Counselor API error:", error);
    return NextResponse.json(
      { error: "Counselor service error. Please try again." },
      { status: 500 }
    );
  }
}

