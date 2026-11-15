import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { checkAdminAccess } from "@/lib/auth/staff-guard";
import { CollegeCreateSchema, CollegeUpdateSchema } from "@/lib/college-validation";

const schema = z.object({ data: CollegeUpdateSchema, expectedUpdatedAt: z.string().datetime() });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkAdminAccess("colleges");
  if (!access.isSuperAdmin) return NextResponse.json({ error: "Only administrators can edit submissions." }, { status: 403 });
  try {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    const body = schema.parse(await request.json());
    const updatedAt = await db.$transaction(async tx => {
      const proposal = await tx.collegeApprovalRequest.findUnique({ where: { id } });
      if (!proposal) throw new Error("Submission not found.");
      const previous = proposal.proposedData as Record<string, unknown>;
      if (previous.__resourceMutation) throw new Error("Edit related college data through its data manager.");
      const data = { ...previous, ...body.data };
      const proposedData = proposal.actionType === "CREATE" ? CollegeCreateSchema.parse(data) : CollegeUpdateSchema.parse(data);
      const now = new Date();
      const claimed = await tx.collegeApprovalRequest.updateMany({
        where: { id, status: "PENDING", updatedAt: new Date(body.expectedUpdatedAt) },
        data: { proposedData: JSON.parse(JSON.stringify(proposedData)), updatedAt: now },
      });
      if (!claimed.count) throw new Error("This submission changed or has already been reviewed. Refresh before editing.");
      await tx.staffActivityLog.create({ data: { staffId: proposal.staffId, collegeId: proposal.collegeId, action: "ADMIN_EDITED_SUBMISSION", details: `${access.userName} edited pending submission ${id} before approval.` } });
      return now;
    });
    revalidatePath("/admin/approvals");
    revalidatePath(`/approval-preview/${id}`, "layout");
    return NextResponse.json({ success: true, updatedAt, message: "Submission updated. It is still awaiting approval." });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "These details conflict with an existing record." }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to edit submission." }, { status: 409 });
  }
}
