import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { checkAdminAccess, canAccessCollege } from "@/lib/auth/staff-guard";
import { revalidatePath } from "next/cache";

const ModerateSchema = z.object({
  reviewId: z.string().uuid(),
  status: z.enum(["APPROVED", "REJECTED"]),
});

export async function POST(req: NextRequest) {
  try {
    const access = await checkAdminAccess("reviews");
    if (!access.allowed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const parsed = ModerateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { reviewId, status } = parsed.data;

    const existing = await db.review.findUnique({ where: { id: reviewId }, include: { college: { select: { slug: true } } } });
    if (!existing) return NextResponse.json({ error: "Review not found" }, { status: 404 });
    if (!canAccessCollege(access, existing.collegeId)) return NextResponse.json({ error: "College access denied" }, { status: 403 });
    const review = await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${existing.collegeId}))`;
      const updated = await tx.review.update({ where: { id: reviewId }, data: { moderationStatus: status, isVerified: status === "APPROVED" } });
      const totals = await tx.review.aggregate({ where: { collegeId: existing.collegeId, moderationStatus: "APPROVED" }, _count: { id: true }, _avg: { ratingOverall: true } });
      await tx.college.update({ where: { id: existing.collegeId }, data: { reviewCount: totals._count.id, ratingOverall: totals._avg.ratingOverall || 0 } });
      return updated;
    });
    revalidatePath(`/college/${existing.college.slug}`, "layout");
    revalidatePath("/colleges", "layout");

    return NextResponse.json({ success: true, review });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update review" }, { status: 500 });
  }
}

