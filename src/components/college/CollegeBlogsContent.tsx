import { staffDisplayName } from "@/lib/staff-display";
import { BlogCoverImage } from "@/components/blog/BlogCoverImage";
import { blogPreviewImage } from "@/lib/blog-image-display";
import React from "react";
import { blogArticleHref } from "@/lib/blog-content";
import Link from "next/link";
export interface CollegeBlogArticle {
  showOnWebsiteBlog?: boolean;
  id: string; slug: string; title: string; category: string; metaDescription: string | null;
  contentMdx?: string; featuredImageUrl: string | null; publishedAt: Date | null; createdAt: Date;
  author: { name: string; designation?: string | null };
}
export function CollegeBlogsContent({ collegeName, collegeSlug, posts }: { collegeName: string; collegeSlug?: string; posts: CollegeBlogArticle[] }) {
  return <section className="space-y-6">
    <div><h1 className="text-2xl font-bold">{collegeName} Blogs &amp; News</h1><p className="mt-2 text-sm text-muted-foreground">Published articles, admission updates and guides linked to this college.</p></div>
    {posts.length === 0 ? <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">No blog articles have been published for this college yet.</p> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map(post => <article key={post.id} className="overflow-hidden rounded-2xl border bg-card">
        <Link href={blogArticleHref({ ...post, showOnWebsiteBlog: post.showOnWebsiteBlog ?? false }, collegeSlug)} className="block" aria-label={`Read ${post.title}`}><BlogCoverImage src={blogPreviewImage(post)} alt={post.title}/></Link>
        <div className="space-y-3 p-5">
          <p className="text-xs font-semibold text-primary">{post.category.replace(/_/g, " ")}</p>
          <h2 className="text-lg font-bold"><Link href={blogArticleHref({ ...post, showOnWebsiteBlog: post.showOnWebsiteBlog ?? false }, collegeSlug)} className="hover:text-primary">{post.title}</Link></h2>
          {post.metaDescription && <p className="line-clamp-3 text-sm text-muted-foreground">{post.metaDescription}</p>}
          <p className="break-words text-xs text-muted-foreground">By {staffDisplayName(post.author)} · <time dateTime={(post.publishedAt || post.createdAt).toISOString()}>{(post.publishedAt || post.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</time></p>
          <Link href={blogArticleHref({ ...post, showOnWebsiteBlog: post.showOnWebsiteBlog ?? false }, collegeSlug)} className="inline-block text-sm font-semibold text-primary">Read article →</Link>
        </div>
      </article>)}
    </div>}
  </section>;
}
