import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { blogCollegeSlugs } from "./blog-content";

type LinkedPost = { slug: string; showOnWebsiteBlog: boolean; contentMdx: string; relatedCollegeId?: string | null };
export async function publishedBlogColleges(post: Pick<LinkedPost, "contentMdx" | "relatedCollegeId">, client: Prisma.TransactionClient = db) {
  return client.college.findMany({ where: { isPublished: true, OR: [ ...(post.relatedCollegeId ? [{ id: post.relatedCollegeId }] : []), { slug: { in: blogCollegeSlugs(post.contentMdx) } } ] }, select: { id: true, slug: true, name: true }, orderBy: { slug: "asc" } });
}
export async function canonicalBlogHref(post: LinkedPost, client: Prisma.TransactionClient = db) {
  if (post.showOnWebsiteBlog) return `/blog/${post.slug}`;
  const colleges = await publishedBlogColleges(post, client);
  const primary = colleges.find(college => college.id === post.relatedCollegeId) || colleges[0];
  return primary ? `/college/${primary.slug}/blogs/${post.slug}` : null;
}
export async function validateBlogDestination(post: Pick<LinkedPost, "showOnWebsiteBlog" | "contentMdx" | "relatedCollegeId">, published: boolean, client: Prisma.TransactionClient = db) {
  if (!post.showOnWebsiteBlog && published && !(await publishedBlogColleges(post, client)).length) return "Link at least one published college before publishing a college-only article.";
  return null;
}
