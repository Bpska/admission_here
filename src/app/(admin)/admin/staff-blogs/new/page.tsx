import { checkAdminAccess } from "@/lib/auth/staff-guard";
import { StaffAccessDenied } from "@/components/admin/StaffAccessDenied";
import NewBlogClient from "./NewBlogClient";
export default async function NewBlogPage() {
 const access = await checkAdminAccess("blogs");
 if (!access.allowed) return <StaffAccessDenied featureName="Blog Desk" allowedFeatures={access.permissions} />;
 return <NewBlogClient canPublish={access.isSuperAdmin || access.role === "AUTHOR" || access.permissions.includes("blogs:publish") || access.permissions.includes("blogs")} />;
}
