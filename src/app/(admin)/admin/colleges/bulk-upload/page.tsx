import { checkAdminAccess } from "@/lib/auth/staff-guard";
import { StaffAccessDenied } from "@/components/admin/StaffAccessDenied";
import { CollegeBulkUpload } from "@/components/admin/CollegeBulkUpload";
export const dynamic = "force-dynamic";
export default async function BulkUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ import?: string }>;
}) {
  const access = await checkAdminAccess("colleges");
  if (!access.isSuperAdmin)
    return (
      <StaffAccessDenied
        featureName="Bulk college imports (Super Administrator only)"
        allowedFeatures={access.permissions}
      />
    );
  const params = await searchParams;
  return <CollegeBulkUpload initialId={params.import} />;
}
