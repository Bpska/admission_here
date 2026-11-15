import { CollegeCoursesContent } from "@/components/college/CollegeCoursesContent";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export default async function CollegeCoursesFeesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const college = await db.college.findUnique({
    where: { slug, isPublished: true },
    include: {
      courses: {
        include: { course: true },
      },
    },
  });

  if (!college) notFound();
  return <CollegeCoursesContent college={college} />;
}
