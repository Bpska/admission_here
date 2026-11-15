import { CollegeAdmissionContent } from "@/components/college/CollegeAdmissionContent";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export default async function CollegeAdmissionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const college = await db.college.findUnique({
    where: { slug, isPublished: true },
  });

  if (!college) notFound();
  return <CollegeAdmissionContent college={college} />;
}
