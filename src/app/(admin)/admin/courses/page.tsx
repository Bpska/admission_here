import { checkAdminAccess } from "@/lib/auth/staff-guard";
import { StaffAccessDenied } from "@/components/admin/StaffAccessDenied";
import { AdminDataEditor } from "@/components/admin/AdminDataEditor";
export default async function CourseCatalogPage() {
  const access = await checkAdminAccess("colleges");
  if (!access.allowed) return <StaffAccessDenied featureName="Course catalog" allowedFeatures={access.permissions} />;
  return <div className="max-w-6xl space-y-5"><h1 className="text-2xl font-bold">Course catalog</h1><p className="text-sm text-muted-foreground">Create degrees here, then assign them to colleges with fees and seat counts.</p><AdminDataEditor resource="courses" /></div>;
}
