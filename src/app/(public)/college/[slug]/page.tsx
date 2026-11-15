import { CollegeOverviewContent } from "@/components/college/CollegeOverviewContent";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export default async function CompleteCollegeDetailsPage({
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
        orderBy: { totalFeesInr: "asc" },
      },
      placements: {
        orderBy: { batchYear: "desc" },
        take: 3,
      },
      rankings: {
        orderBy: { rankingYear: "desc" },
        take: 4,
      },
      reviews: {
        where: { moderationStatus: "APPROVED" },
        take: 2,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!college) notFound();

  // Related colleges (same state or published institutions)
  const relatedColleges = await db.college.findMany({
    where: {
      id: { not: college.id },
      isPublished: true,
      OR: [
        { state: college.state },
        { ownershipType: college.ownershipType },
      ],
    },
    take: 3,
    include: {
      courses: {
        include: { course: true },
        take: 1,
      },
    },
  });


  return <CollegeOverviewContent college={college} relatedColleges={relatedColleges} />;
}
