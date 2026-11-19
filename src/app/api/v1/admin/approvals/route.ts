import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAccess } from "@/lib/auth/staff-guard";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validateCustomNavbarFilter } from "@/lib/custom-navbar-filters";
import { createCollegeProfile } from "@/lib/create-college-profile";
import { CollegeCreateSchema, CollegeUpdateSchema } from "@/lib/college-validation";
import { applyDataMutation, type DataMutation } from "@/lib/admin-data";

export async function GET(request: Request) {
  const access = await checkAdminAccess("colleges");
  if (!access.allowed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = new URL(request.url).searchParams.get("status");
  if (status && status !== "ALL" && !["PENDING", "APPROVED", "REJECTED", "REVISION_REQUESTED"].includes(status)) return NextResponse.json({ error: "Invalid approval status" }, { status: 400 });
  const where: Prisma.CollegeApprovalRequestWhereInput = { ...(access.isSuperAdmin ? {} : { staffId: access.userId }), ...(status && status !== "ALL" ? { status: status as any } : {}) };
  const [requests, activityLogs] = await Promise.all([
    db.collegeApprovalRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { staff: { select: { id: true, name: true, email: true } }, college: { select: { id: true, name: true, slug: true, city: true, state: true } }, reviewedBy: { select: { id: true, name: true } } } }),
    db.staffActivityLog.findMany({ where: access.isSuperAdmin ? {} : { staffId: access.userId }, orderBy: { createdAt: "desc" }, take: 30, include: { staff: { select: { name: true, email: true } } } }),
  ]);
  return NextResponse.json({ success: true, requests, activityLogs, isSuperAdmin: access.isSuperAdmin });
}

const reviewSchema = z.object({ requestId: z.string().uuid(), action: z.enum(["APPROVE", "REJECT", "REQUEST_REVISION"]), adminFeedback: z.string().max(4000).optional(), expectedUpdatedAt: z.string().datetime().optional() });
export async function PATCH(request: Request) {
  const access = await checkAdminAccess("colleges");
  if (!access.isSuperAdmin) return NextResponse.json({ error: "Only Super Administrators can review requests." }, { status: 403 });
  try {
    const { requestId, action, adminFeedback, expectedUpdatedAt } = reviewSchema.parse(await request.json());
    const status = action === "APPROVE" ? "APPROVED" : action === "REJECT" ? "REJECTED" : "REVISION_REQUESTED";
    await db.$transaction(async tx => {
      const proposal = await tx.collegeApprovalRequest.findUnique({ where: { id: requestId } });
      if (!proposal) throw new Error("Request not found");
      // Claim the pending request inside the same transaction as the data change.
      // Concurrent reviews and repeated clicks cannot apply it twice.
      const claimed = await tx.collegeApprovalRequest.updateMany({ where: { id: requestId, status: "PENDING", ...(expectedUpdatedAt ? { updatedAt: new Date(expectedUpdatedAt) } : {}) }, data: { status, reviewedById: access.userId, reviewedAt: new Date(), adminFeedback: adminFeedback || (action === "APPROVE" ? "Approved." : action === "REJECT" ? "Rejected." : "Please revise and submit a new request.") } });
      if (!claimed.count) throw new Error("This submission changed or has already been reviewed. Refresh before reviewing it again.");
      let collegeId = proposal.collegeId;
      if (action === "APPROVE") {
        const proposed = proposal.proposedData as Record<string, any>;
        if (proposed.__resourceMutation) {
          const mutation = proposed.__resourceMutation as DataMutation;
          if (!["offerings", "cutoffs", "placements", "rankings"].includes(mutation.resource) || mutation.collegeId !== collegeId) throw new Error("Invalid college data proposal.");
          await applyDataMutation(tx, mutation, access.userId);
        } else if (proposal.actionType === "CREATE") {
          const college = await createCollegeProfile(tx, proposed, access.userId, proposal.staffId);
          collegeId = college.id;
          await tx.collegeApprovalRequest.update({ where: { id: requestId }, data: { collegeId } });
          await tx.staffPermission.update({ where: { userId: proposal.staffId }, data: { assignedCollegeIds: { push: collegeId } } });
        } else {
          if (!collegeId) throw new Error("Missing college on update request");
          const update = CollegeUpdateSchema.parse(proposed);
          await validateCustomNavbarFilter(tx, update);
          await tx.college.update({ where: { id: collegeId }, data: update });
        }
      }
      await tx.staffActivityLog.create({ data: { staffId: proposal.staffId, collegeId, action: status, details: `${access.userName}: ${status}. ${adminFeedback || ""}` } });
    });
    revalidatePath("/", "layout");
    return NextResponse.json({ success: true, status, message: action === "APPROVE" ? "Approved changes are now published." : action === "REJECT" ? "Request rejected. Published data is unchanged." : "Revision requested. Staff can submit a corrected request." });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "These details conflict with an existing record. Request a revision." }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to review request" }, { status: 409 });
  }
}
