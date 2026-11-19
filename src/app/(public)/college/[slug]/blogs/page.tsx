import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { constructSeoMetadata } from "@/lib/seo/metadata";
import { getCollegeBlogPosts } from "@/lib/college-blogs";
import { CollegeBlogsContent } from "@/components/college/CollegeBlogsContent";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
async function getCollege(params: Props["params"]) {
  const { slug } = await params;
  const college = await db.college.findUnique({ where: { slug, isPublished: true }, select: { id: true, slug: true, name: true } });
  if (!college) notFound();
  return college;
}
export async function generateMetadata({ params }: Props) {
  const college = await getCollege(params);
  return constructSeoMetadata({ title: `${college.name} Blogs & News`, description: `Read articles, admission updates and guides linked to ${college.name}.`, canonicalPath: `/college/${college.slug}/blogs` });
}
export default async function CollegeBlogsPage({ params }: Props) {
  const college = await getCollege(params);
  return <CollegeBlogsContent collegeSlug={college.slug} collegeName={college.name} posts={await getCollegeBlogPosts(college)} />;
}
