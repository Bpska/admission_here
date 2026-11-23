import { blogPreviewImage } from "./blog-image-display";
import { BlogPost, Prisma } from "@prisma/client";
import { db } from "./db";
import { getCollegeBlogPosts } from "./college-blogs";
import { blogArticleHref } from "./blog-content";
import { suggestionKeywords } from "./blog-suggestions";
export async function relatedBlogArticles(post: BlogPost, college: { id: string; slug: string } | null, client: Prisma.TransactionClient = db) {
  const candidates = college ? await getCollegeBlogPosts(college, { status: "PUBLISHED", showOnWebsiteBlog: false, id: { not: post.id } }, client) : await client.blogPost.findMany({ where: { status: "PUBLISHED", showOnWebsiteBlog: true, id: { not: post.id }, OR: [{ category: post.category }, ...(post.tags.length ? [{ tags: { hasSome: post.tags } }] : [])] }, orderBy: [{ publishedAt: "desc" }, { id: "asc" }], take: 40 });
  const keywords = new Set(suggestionKeywords(post.title)); const tags = new Set(post.tags.map(tag => tag.toLowerCase()));
  return candidates.map(candidate => ({ candidate, score: (candidate.category === post.category ? 5 : 0) + candidate.tags.filter(tag => tags.has(tag.toLowerCase())).length * 3 + suggestionKeywords(candidate.title).filter(word => keywords.has(word)).length }))
    .sort((a, b) => b.score - a.score || (b.candidate.publishedAt?.getTime() || b.candidate.createdAt.getTime()) - (a.candidate.publishedAt?.getTime() || a.candidate.createdAt.getTime()))
    .slice(0, 3).map(({ candidate }) => ({ id: candidate.id, title: candidate.title, imageUrl: blogPreviewImage(candidate), description: candidate.metaDescription, href: blogArticleHref(candidate, college?.slug), category: candidate.category.replace(/_/g, " ") }));
}
