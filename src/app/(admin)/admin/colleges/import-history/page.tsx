import { checkAdminAccess } from "@/lib/auth/staff-guard";
import { StaffAccessDenied } from "@/components/admin/StaffAccessDenied";
import { CollegeImportHistory } from "@/components/admin/CollegeImportHistory";
export const dynamic = "force-dynamic";
export default async function ImportHistoryPage() {
  const access = await checkAdminAccess("colleges");
  if (!access.isSuperAdmin)
    return (
      <StaffAccessDenied
        featureName="College import history (Super Administrator only)"
        allowedFeatures={access.permissions}
      />
    );
  return <CollegeImportHistory />;
}
