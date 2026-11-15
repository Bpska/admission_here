import { CollegePlacementsContent } from "@/components/college/CollegePlacementsContent";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export default async function CollegePlacementsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const college = await db.college.findUnique({
    where: { slug, isPublished: true },
    include: {
      placements: {
        orderBy: { batchYear: "desc" },
      },
    },
  });

  if (!college) notFound();
  return <CollegePlacementsContent college={college} />;
}
