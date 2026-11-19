import { db } from "@/lib/db";
import { checkAdminAccess } from "@/lib/auth/staff-guard";
import { StaffAccessDenied } from "@/components/admin/StaffAccessDenied";
import NewBlogClient from "./NewBlogClient";
export default async function NewBlogPage({ searchParams }: { searchParams: Promise<{ college?: string; destination?: string }> }) {
 const access = await checkAdminAccess("blogs");
 if (!access.allowed) return <StaffAccessDenied featureName="Blog Desk" allowedFeatures={access.permissions} />;
 const { college: slug, destination } = await searchParams;
 const college = slug ? await db.college.findUnique({ where: { slug, isPublished: true }, select: { slug: true } }) : null;
 return <NewBlogClient initialDestination={destination === "college" || college ? "college" : "website"} initialCollegeSlug={college?.slug} canPublish={access.isSuperAdmin || access.role === "AUTHOR" || access.permissions.includes("blogs:publish") || access.permissions.includes("blogs")} />;
}
