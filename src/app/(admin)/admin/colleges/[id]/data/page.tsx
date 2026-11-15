import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { checkAdminAccess, canAccessCollege } from "@/lib/auth/staff-guard";
import { CollegeDataManager } from "@/components/admin/CollegeDataManager";

export default async function CollegeDataPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await checkAdminAccess("colleges");
  const { id } = await params;
  if (!access.allowed || !canAccessCollege(access, id)) notFound();
  const college = await db.college.findUnique({ where: { id }, select: { name: true, slug: true } });
  if (!college) notFound();
  return <div className="max-w-6xl space-y-5"><Link href={`/admin/colleges/${id}/edit`} className="text-sm text-primary underline">Back to profile editor</Link><h1 className="text-2xl font-bold">{college.name}: courses and outcomes</h1><CollegeDataManager collegeId={id} /></div>;
}
