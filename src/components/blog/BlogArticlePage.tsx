import { relatedBlogArticles } from "@/lib/related-blog-articles";
import { RelatedBlogArticles } from "./RelatedBlogArticles";
import { blogEngagement } from "@/lib/blog-engagement";
import { BlogEngagement } from "@/components/blog/BlogEngagement";
import { getPostBlogStats } from "@/lib/blog-analytics";
import { BlogViewTracker } from "@/components/blog/BlogViewTracker";
import { canonicalBlogHref, publishedBlogColleges } from "@/lib/blog-destination";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { constructSeoMetadata } from "@/lib/seo/metadata";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import {
  generateNewsArticleJsonLd,
  generateFaqJsonLd,
  generateBreadcrumbJsonLd
} from "@/lib/seo/json-ld";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { RichBlogRenderer } from "@/components/blog/RichBlogRenderer";
import { Calendar, User, Radio, Eye, Clock, HelpCircle } from "lucide-react";
import type { LiveUpdateItem } from "@/components/blog/LiveBlogTicker";



interface BlogPostPageProps {
  params: Promise<{ slug: string; collegeSlug?: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await db.blogPost.findUnique({
    where: { slug, status: "PUBLISHED" },

  });

  if (!post) {
    return constructSeoMetadata({
      title: "Article Not Found",
      description: "The requested article could not be found.",
    });
  }

  return constructSeoMetadata({
    title: post.metaTitle || post.title,
    description: post.metaDescription || `Read ${post.title} on AdmissionsHub.`,
    canonicalPath: (await canonicalBlogHref(post)) || `/blog/${slug}`,
    type: "article",
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug, collegeSlug } = await params;

  const post = await db.blogPost.findUnique({
    where: { slug, status: "PUBLISHED" },
    include: {
      author: { select: { name: true } },
      relatedCollege: {
        select: {
          id: true,
          slug: true,
          name: true,
          city: true,
          state: true,
          nirfRank: true,
          ratingOverall: true,
          logoUrl: true,
          isPublished: true,
        },
      },
    },
  });

  if (!post) notFound();

  const canonicalPath = await canonicalBlogHref(post);
  if (!canonicalPath) notFound();
  if (post.showOnWebsiteBlog && collegeSlug) redirect(canonicalPath);
  if (!post.showOnWebsiteBlog && !collegeSlug) redirect(canonicalPath);
  const college = !post.showOnWebsiteBlog ? (await publishedBlogColleges(post)).find(c => c.slug === collegeSlug) : null;
  if (!post.showOnWebsiteBlog && !college) notFound();

  const stats = await getPostBlogStats(post.id);
  const engagement = await blogEngagement(post.id, "");
  const relatedArticles = await relatedBlogArticles(post, college || null);

  // NewsArticle JSON-LD
  const articleSchema = generateNewsArticleJsonLd({
    title: post.title,
    slug: post.slug,
    metaDescription: post.metaDescription,
    featuredImageUrl: post.featuredImageUrl,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    authorName: post.author.name,
    canonicalPath,
  });

  // FAQPage JSON-LD
  const faqs = (post.faqsJson as Array<{ question: string; answer: string }>) || [];
  const faqSchema = generateFaqJsonLd(faqs);

  const breadcrumbs = college ? [
    { label: college.name, href: `/college/${college.slug}` },
    { label: "College Blogs", href: `/college/${college.slug}/blogs` },
    { label: post.title },
  ] : [
    { label: "Blog", href: "/blog" },
    { label: post.category.replace("_", " "), href: `/blog/category/${post.category.toLowerCase().replace(/_/g, "-")}` },
    { label: post.title },
  ];

  const breadcrumbSchema = generateBreadcrumbJsonLd(
    breadcrumbs.map((b) => ({ name: b.label, url: b.href || canonicalPath }))
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <JsonLdScript data={[articleSchema, faqSchema, breadcrumbSchema].filter(Boolean)} />

      <Breadcrumbs items={breadcrumbs} />

      {/* Header */}
      <header className="space-y-4 border-b pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary/10 text-primary uppercase tracking-wider">
            {post.category.replace("_", " ")}
          </span>
          {post.isLiveBlog && (
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-red-600 bg-red-500/10 px-3 py-1 rounded-full animate-pulse">
              <Radio className="w-3.5 h-3.5" /> LIVE UPDATES
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
          {post.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <User className="w-3.5 h-3.5 text-primary" />
            <span>By {post.author.name}</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <time dateTime={new Date(post.publishedAt || post.createdAt).toISOString()}>
              Published on {new Date(post.publishedAt || post.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            <BlogViewTracker key={post.id} blogId={post.id} initialViews={stats.views} />
          </span>
        </div>
      </header>

      {/* Main Body with MDX & Shortcodes (TLDR, Live Ticker, College CTA) */}
      <RichBlogRenderer
        content={post.contentMdx}
        tldrSummary={post.tldrSummary}
        isLiveBlog={post.isLiveBlog}
        liveUpdates={(post.liveUpdatesJson as unknown as LiveUpdateItem[]) || undefined}
        relatedCollege={post.relatedCollege?.isPublished ? post.relatedCollege : null}
        blogId={post.id}
      />

      {/* FAQs Section */}
      {faqs.length > 0 && (
        <section className="pt-8 border-t space-y-4">
          <h3 className="font-extrabold text-lg text-foreground flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            <span>Frequently Asked Questions</span>
          </h3>

          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="p-4 rounded-xl border bg-muted/20 space-y-1.5 text-xs">
                <h4 className="font-bold text-foreground text-sm">{f.question}</h4>
                <p className="text-muted-foreground leading-relaxed">{f.answer}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      <RelatedBlogArticles articles={relatedArticles} />
      <BlogEngagement blogId={post.id} initialData={engagement ? { ...engagement, comments: engagement.comments.map(comment => ({ ...comment, createdAt: comment.createdAt.toISOString() })) } : undefined} />
    </div>
  );
}
