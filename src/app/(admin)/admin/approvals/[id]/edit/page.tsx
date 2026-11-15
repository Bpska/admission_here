import { notFound } from "next/navigation";
import { loadApprovalCollege } from "@/lib/approval-college";
import { EditCollegeClient } from "../../../colleges/[id]/edit/EditCollegeClient";

export default async function EditApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { request, college, isSuperAdmin } = await loadApprovalCollege(id, false);
  if (!isSuperAdmin || request.status !== "PENDING" || (request.proposedData as Record<string, unknown>).__resourceMutation) notFound();
  return <EditCollegeClient college={college} approvalRequest={{ id, updatedAt: request.updatedAt.toISOString() }} />;
}
