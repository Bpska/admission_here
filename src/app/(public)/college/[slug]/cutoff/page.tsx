import { CollegeCutoffContent } from "@/components/college/CollegeCutoffContent";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export default async function CollegeCutoffPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const college = await db.college.findUnique({
    where: { slug, isPublished: true },
    include: {
      courses: {
        include: {
          course: true,
          cutoffs: {
            include: { exam: true },
            orderBy: [{ academicYear: "desc" }, { counselingRound: "asc" }, { closingRank: "asc" }],
          },
        },
      },
    },
  });

  if (!college) notFound();
  return <CollegeCutoffContent college={college} />;
}
