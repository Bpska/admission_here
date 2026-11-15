import { checkAdminAccess } from "@/lib/auth/staff-guard";
import { StaffAccessDenied } from "@/components/admin/StaffAccessDenied";
import { NewCollegeClient } from "./NewCollegeClient";

export default async function NewCollegePage() {
  const access = await checkAdminAccess("colleges");
  if (!access.allowed) {
    return <StaffAccessDenied featureName="Add New College" allowedFeatures={access.permissions} />;
  }

  return <NewCollegeClient requiresApproval={!access.isSuperAdmin} />;
}
