import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { blogCollegeSlugs } from "./blog-content";

type CollegeReference = { id: string; slug: string };
export function isBlogLinkedToCollege(post: { relatedCollegeId?: string | null; contentMdx: string }, college: CollegeReference) {
  return post.relatedCollegeId === college.id || blogCollegeSlugs(post.contentMdx).includes(college.slug);
}
export async function getCollegeBlogPosts(college: CollegeReference, scope: Prisma.BlogPostWhereInput = { status: "PUBLISHED", showOnWebsiteBlog: false }, client: Prisma.TransactionClient = db) {
  const candidates = await client.blogPost.findMany({
    where: { AND: [scope, { OR: [{ relatedCollegeId: college.id }, { contentMdx: { contains: college.slug } }] }] },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    include: { author: { select: { name: true, designation: true } } },
  });
  // Exact parsed membership prevents ordinary text or a similar college slug
  // from adding an unrelated article to this college's page.
  return candidates.filter(post => isBlogLinkedToCollege(post, college));
}
