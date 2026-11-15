import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const PredictorSchema = z.object({
  examSlug: z.string().default("jee-main"),
  rank: z.coerce.number().finite().min(0).max(100000000),
  category: z.enum(["GEN", "OBC", "EWS", "SC", "ST"]).default("GEN"),
  quota: z.enum(["AI", "HS", "OS", "ALL"]).default("AI"),
  homeState: z.string().optional().nullable(),
  targetCourse: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = PredictorSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid predictor inputs", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { examSlug, rank, category, quota, homeState, targetCourse } = parsed.data;

    const percentile = examSlug === "cat";
    if ((percentile && rank > 100) || (!percentile && (!Number.isInteger(rank) || rank < 1))) return NextResponse.json({error: percentile ? "Enter a percentile between 0 and 100." : "Enter a positive whole-number rank."}, {status:400});
    if ((quota === "HS" || quota === "OS") && !homeState?.trim()) return NextResponse.json({error:"Select your home state for this quota."}, {status:400});
    // Find the exam
    const exam = await db.exam.findUnique({
      where: { slug: examSlug },
    });

    if (!exam) {
      return NextResponse.json({ error: "Selected entrance examination not found." }, { status: 404 });
    }

    // Query historical cutoffs for this exam matching category & quotas
    const whereConditions: any = {
      examId: exam.id,
      collegeCourse: { college: { isPublished: true } },
      category: { equals: category, mode: "insensitive" },
    };

    if (quota && quota !== "ALL") {
      whereConditions.quota = { in: [quota, "AI"] };
    }

    const cutoffs = await db.examCutoff.findMany({
      where: whereConditions,
      include: {
        collegeCourse: {
          include: {
            college: true,
            course: true,
          },
        },
      },
      orderBy: [{ academicYear: "desc" }, { counselingRound: "desc" }],
    });

    // Optional filter by target course / stream if specified
    const seen = new Set<string>();
    const eligibleCutoffs = cutoffs.filter(c => {
      if (percentile ? c.cutoffPercentile == null : c.closingRank == null || c.closingRank <= 0) return false;
      const sameState = c.collegeCourse.college.state.toLowerCase() === homeState?.trim().toLowerCase();
      if (c.quota === "HS" && !sameState) return false;
      if (c.quota === "OS" && (!homeState || sameState)) return false;
      const key = `${c.collegeCourseId}:${c.quota}:${c.category}:${c.gender}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
    const filteredCutoffs = targetCourse && targetCourse !== "ALL"
      ? eligibleCutoffs.filter((c) =>
          c.collegeCourse.specialization.toLowerCase().includes(targetCourse.toLowerCase()) ||
          c.collegeCourse.course.degree.toLowerCase().includes(targetCourse.toLowerCase()) ||
          c.collegeCourse.course.stream.toLowerCase().includes(targetCourse.toLowerCase())
        )
      : eligibleCutoffs;

    if (filteredCutoffs.length === 0) {
      return NextResponse.json({
        success: true,
        insufficientData: true,
        message: "Sufficient verified historical cutoff data is not currently available for this exact combination. Predictions cannot be reliably determined. Please consult an official admissions counselor.",
        query: { examSlug, rank, category, quota, homeState, targetCourse },
        totalFound: 0,
        predictions: {
          highChance: [],
          moderateChance: [],
          lowChance: [],
        },
      });
    }

    const highProbability: any[] = [];
    const moderateProbability: any[] = [];
    const lowProbability: any[] = [];

    filteredCutoffs.forEach((item) => {
      const closing = item.closingRank;
      const option = {
        id: item.id,
        collegeName: item.collegeCourse.college.name,
        collegeShortName: item.collegeCourse.college.shortName,
        collegeSlug: item.collegeCourse.college.slug,
        city: item.collegeCourse.college.city,
        state: item.collegeCourse.college.state,
        logoUrl: item.collegeCourse.college.logoUrl,
        nirfRank: item.collegeCourse.college.nirfRank,
        degree: item.collegeCourse.course.degree,
        specialization: item.collegeCourse.specialization,
        fees: item.collegeCourse.totalFeesInr,
        academicYear: item.academicYear,
        round: item.counselingRound,
        category: item.category,
        quota: item.quota,
        closingRank: closing,
        cutoffPercentile: item.cutoffPercentile,
        openingRank: item.openingRank,
        eligibility: item.collegeCourse.eligibilityCriteria,
      };

      // Classification based on student AIR compared to closing rank
      if (percentile ? rank >= item.cutoffPercentile! + 2 : closing! >= rank * 1.15) {
        highProbability.push({ ...option, chanceCategory: "High Chance" });
      } else if (percentile ? rank >= item.cutoffPercentile! : closing! >= rank * 0.9) {
        moderateProbability.push({ ...option, chanceCategory: "Moderate Chance" });
      } else {
        lowProbability.push({ ...option, chanceCategory: "Low Chance" });
      }
    });

    return NextResponse.json({
      success: true,
      insufficientData: false,
      query: { examSlug, rank, category, quota, homeState, targetCourse },
      totalFound: filteredCutoffs.length,
      predictions: {
        highChance: highProbability.slice(0, 15),
        moderateChance: moderateProbability.slice(0, 15),
        lowChance: lowProbability.slice(0, 15),
      },
    });
  } catch (error) {
    console.error("Predictor engine error:", error);
    return NextResponse.json(
      { error: "Error calculating admission predictions" },
      { status: 500 }
    );
  }
}
