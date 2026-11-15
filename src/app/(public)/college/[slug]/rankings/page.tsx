import { CollegeRankingsContent } from "@/components/college/CollegeRankingsContent";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export default async function CollegeRankingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const college = await db.college.findUnique({
    where: { slug, isPublished: true },
    include: {
      rankings: {
        orderBy: [{ rankingYear: "desc" }, { rankNumber: "asc" }],
      },
    },
  });

  if (!college) notFound();
  return <CollegeRankingsContent college={college} />;
}
