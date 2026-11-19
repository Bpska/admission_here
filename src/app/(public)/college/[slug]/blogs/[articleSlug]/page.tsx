import BlogArticlePage, { generateMetadata as articleMetadata } from "@/components/blog/BlogArticlePage";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string; articleSlug: string }> };
async function articleParams(params: Props["params"]) {
  const { slug, articleSlug } = await params;
  return { slug: articleSlug, collegeSlug: slug };
}
export async function generateMetadata({ params }: Props) { return articleMetadata({ params: articleParams(params) }); }
export default async function CollegeArticlePage({ params }: Props) { return BlogArticlePage({ params: articleParams(params) }); }
