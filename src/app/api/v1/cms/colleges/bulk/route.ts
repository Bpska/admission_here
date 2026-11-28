import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "@/lib/auth/staff-guard";
import { isSameSiteRequest } from "@/lib/security";
import { limitedBody } from "@/lib/college-import/http";
import { bulkDeleteCollegesSchema, deleteSelectedColleges } from "@/lib/college-bulk-delete";

export async function DELETE(request: Request) {
  if (!isSameSiteRequest(request))
    return NextResponse.json({ error: "Same-site requests only." }, { status: 403 });
  const access = await checkAdminAccess("colleges");
  if (!access.allowed || !access.isSuperAdmin)
    return NextResponse.json({ error: "Only Super Administrators can delete colleges." }, { status: 403 });

  let payload: unknown;
  try {
    payload = JSON.parse((await limitedBody(request, 32 * 1024)).toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Invalid bulk delete request." }, { status: 400 });
  }
  const selection = bulkDeleteCollegesSchema.safeParse(payload);
  if (!selection.success)
    return NextResponse.json({ error: "Select valid college records and confirm deletion." }, { status: 400 });

  try {
    const result = await deleteSelectedColleges(selection.data.ids);
    try {
      revalidatePath("/", "layout");
    } catch (error) {
      console.error("Bulk college delete cache refresh failed", error);
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Bulk college delete failed", error);
    return NextResponse.json({ error: "Bulk deletion could not be completed." }, { status: 500 });
  }
}
