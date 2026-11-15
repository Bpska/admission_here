import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const rating = z.number().min(1).max(5);
const schema = z.object({ collegeId: z.string().uuid(), title: z.string().trim().min(3).max(150), courseName: z.string().trim().min(2).max(150), batchYear: z.number().int().min(1950).max(new Date().getFullYear() + 10), ratingOverall: rating, ratingPlacements: rating, ratingInfra: rating, ratingFaculty: rating, ratingValueRoi: rating, prosText: z.string().trim().min(10).max(5000), consText: z.string().trim().min(10).max(5000) });
export async function POST(request: Request) {
  const session = await auth(); const user = session?.user as any;
  if (user?.role !== "STUDENT") return NextResponse.json({ error: "Sign in with a student account to write a review." }, { status: 401 });
  try {
    const input = schema.parse(await request.json());
    const college = await db.college.findUnique({ where: { id: input.collegeId, isPublished: true }, select: { slug: true } });
    if (!college) return NextResponse.json({ error: "College not found" }, { status: 404 });
    const review = await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.collegeId}))`;
      const previous = await tx.review.findFirst({ where: { collegeId: input.collegeId, userId: user.id } });
      const data = { ...input, userId: user.id, moderationStatus: "PENDING", isVerified: false };
      const saved = previous ? await tx.review.update({ where: { id: previous.id }, data }) : await tx.review.create({ data });
      const totals = await tx.review.aggregate({ where: { collegeId: input.collegeId, moderationStatus: "APPROVED" }, _count: { id: true }, _avg: { ratingOverall: true } });
      await tx.college.update({ where: { id: input.collegeId }, data: { reviewCount: totals._count.id, ratingOverall: totals._avg.ratingOverall || 0 } });
      return saved;
    });
    revalidatePath(`/college/${college.slug}`, "layout");
    revalidatePath("/colleges", "layout");
    return NextResponse.json({ success: true, reviewId: review.id, message: "Your review was submitted for moderation. It will appear publicly after approval." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? error.issues[0]?.message : "Unable to submit review. Please try again." }, { status: 400 });
  }
}
