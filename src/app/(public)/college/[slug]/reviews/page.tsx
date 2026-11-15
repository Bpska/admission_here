import { CollegeReviewsContent } from "@/components/college/CollegeReviewsContent";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export default async function CollegeReviewsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const college = await db.college.findUnique({
    where: { slug, isPublished: true },
    include: {
      reviews: {
        where: { moderationStatus: "APPROVED" },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!college) notFound();
  return <CollegeReviewsContent college={college} />;
}
