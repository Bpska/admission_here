import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { z } from "zod";
import { INDIAN_STATES } from "@/lib/india-locations";
import { isSameSiteRequest } from "@/lib/security";

async function student() {
  const session = await auth();
  const user = session?.user as any;
  return user?.role === "STUDENT" ? user : null;
}
export async function GET() {
  const user = await student();
  if (!user) return NextResponse.json({ error: "Sign in with a student account." }, { status: 401 });
  const [profile, applications, reviews] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, select: { id: true, name: true, email: true, phone: true, targetStream: true, examScores: true } }),
    db.lead.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true, status: true, ctaType: true, targetCourse: true, targetStream: true, createdAt: true, targetCollege: { select: { name: true, slug: true, isPublished: true } } } }),
    db.review.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true, collegeId: true, title: true, courseName: true, batchYear: true, ratingOverall: true, ratingPlacements: true, ratingInfra: true, ratingFaculty: true, ratingValueRoi: true, prosText: true, consText: true, moderationStatus: true, college: { select: { name: true, slug: true, isPublished: true } } } }),
  ]);
  return NextResponse.json({ profile, applications, reviews }, { headers: { "Cache-Control": "private, no-store" } });
}

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().refine(value => !value || /^(?:\+91|91|0)?[6-9]\d{9}$/.test(value.replace(/[\s()-]/g, "")), "Enter a valid Indian mobile number."),
  targetStream: z.string().trim().max(100),
  examScores: z.object({ entranceExam: z.enum(["jee-main", "neet-ug", "cat"]), rank: z.number().min(0).max(100000000).nullable(), category: z.enum(["GEN", "OBC", "SC", "ST", "EWS"]), homeState: z.string().refine(value => !value || INDIAN_STATES.includes(value), "Select a valid state.") }),
});
export async function PATCH(request: Request) {
  if (!isSameSiteRequest(request)) return NextResponse.json({ error: "Same-site requests only." }, { status: 403 });
  const user = await student();
  if (!user) return NextResponse.json({ error: "Sign in with a student account." }, { status: 401 });
  try {
    const input = schema.parse(await request.json());
    if (input.examScores.rank != null && (input.examScores.entranceExam === "cat" ? input.examScores.rank > 100 : !Number.isInteger(input.examScores.rank) || input.examScores.rank < 1)) return NextResponse.json({error:"Enter a valid exam rank or percentile."},{status:400});
    const digits = input.phone.replace(/\D/g, "");
    const phone = digits ? `+91${digits.slice(-10)}` : null;
    await db.user.update({ where: { id: user.id }, data: { name: input.name, phone, targetStream: input.targetStream || null, examScores: input.examScores } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to save profile. This mobile number may already belong to another account." }, { status: 400 });
  }
}
