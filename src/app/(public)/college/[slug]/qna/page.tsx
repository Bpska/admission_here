import { CollegeQnaContent } from "@/components/college/CollegeQnaContent";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export default async function CollegeQnaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const college = await db.college.findUnique({
    where: { slug, isPublished: true },
  });

  if (!college) notFound();
  return <CollegeQnaContent college={college} />;
}
