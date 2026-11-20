import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { StudentPortal } from "@/components/public/StudentPortal";
import { portalDestination } from "@/lib/portal-navigation";

export const dynamic = "force-dynamic";

export default async function StudentPage() {
  const session = await auth(); const user = session?.user as any;
  if (!user) redirect("/login?callbackUrl=%2Fstudent");
  if (user.role !== "STUDENT") redirect(portalDestination(user.role, user.managedCollegeId));
  return <StudentPortal />;
}
