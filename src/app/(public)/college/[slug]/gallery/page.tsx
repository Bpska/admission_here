import { CollegeGalleryContent } from "@/components/college/CollegeGalleryContent";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export default async function CollegeGalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const college = await db.college.findUnique({
    where: { slug, isPublished: true },
  });

  if (!college) notFound();
  return <CollegeGalleryContent college={college} />;
}
