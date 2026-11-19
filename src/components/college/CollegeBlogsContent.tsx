import React from "react";
import { blogArticleHref } from "@/lib/blog-content";
import Link from "next/link";
export interface CollegeBlogArticle {
  showOnWebsiteBlog?: boolean;
  id: string; slug: string; title: string; category: string; metaDescription: string | null;
  featuredImageUrl: string | null; publishedAt: Date | null; createdAt: Date;
  author: { name: string };
}
export function CollegeBlogsContent({ collegeName, collegeSlug, posts }: { collegeName: string; collegeSlug?: string; posts: CollegeBlogArticle[] }) {
  return <section className="space-y-6">
    <div><h1 className="text-2xl font-bold">{collegeName} Blogs &amp; News</h1><p className="mt-2 text-sm text-muted-foreground">Published articles, admission updates and guides linked to this college.</p></div>
    {posts.length === 0 ? <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">No blog articles have been published for this college yet.</p> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map(post => <article key={post.id} className="overflow-hidden rounded-2xl border bg-card">
        {post.featuredImageUrl && <Link href={blogArticleHref({ ...post, showOnWebsiteBlog: post.showOnWebsiteBlog ?? false }, collegeSlug)} tabIndex={-1} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.featuredImageUrl} alt="" loading="lazy" className="aspect-video w-full object-cover" />
        </Link>}
        <div className="space-y-3 p-5">
          <p className="text-xs font-semibold text-primary">{post.category.replace(/_/g, " ")}</p>
          <h2 className="text-lg font-bold"><Link href={blogArticleHref({ ...post, showOnWebsiteBlog: post.showOnWebsiteBlog ?? false }, collegeSlug)} className="hover:text-primary">{post.title}</Link></h2>
          {post.metaDescription && <p className="line-clamp-3 text-sm text-muted-foreground">{post.metaDescription}</p>}
          <p className="text-xs text-muted-foreground">By {post.author.name} · <time dateTime={(post.publishedAt || post.createdAt).toISOString()}>{(post.publishedAt || post.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</time></p>
          <Link href={blogArticleHref({ ...post, showOnWebsiteBlog: post.showOnWebsiteBlog ?? false }, collegeSlug)} className="inline-block text-sm font-semibold text-primary">Read article →</Link>
        </div>
      </article>)}
    </div>}
  </section>;
}
