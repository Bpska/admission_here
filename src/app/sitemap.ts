import { canonicalBlogHref } from "@/lib/blog-destination";
import { programChoices, collegeProgramHref } from "@/lib/college-programs";
import type { MetadataRoute } from "next";
import { getCustomNavbarFilters } from "@/lib/custom-navbar-filters";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://admissionshub.in";

  // Static high priority roots
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/colleges`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/college-predictor/jee-main`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
  ];

  // College routes + 9 Sub-tabs
  const colleges = await db.college.findMany({
    where: { isPublished: true },
    select: { slug: true, updatedAt: true, courses: { select: { course: { select: { degree: true, fullName: true, stream: true } } } } },
  });

  const collegeTabs = [
    "",
    "/courses-fees",
    "/admission",
    "/cutoff",
    "/placements",
    "/rankings",
    "/gallery",
    "/reviews",
    "/qna",
    "/blogs",
  ];

  const collegeRoutes: MetadataRoute.Sitemap = colleges.flatMap((c) => [
    {
      url: `${baseUrl}/colleges/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    ...collegeTabs.map((tab) => ({
      url: `${baseUrl}/college/${c.slug}${tab}`,
      lastModified: c.updatedAt,
      changeFrequency: tab === "" ? ("daily" as const) : ("weekly" as const),
      priority: tab === "" ? 0.9 : 0.7,
    })),
  ]);

  const programmeRoutes: MetadataRoute.Sitemap = colleges.flatMap(college => programChoices(college.courses).flatMap(program => ["", "courses-fees", "admission", "cutoff", "placements", "rankings", "reviews"].map(tab => ({ url: `${baseUrl}${collegeProgramHref(college.slug, program.key, tab)}`, lastModified: college.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 }))));

  // Blog posts
  const blogs = await db.blogPost.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, updatedAt: true, showOnWebsiteBlog: true, contentMdx: true, relatedCollegeId: true },
  });

  const blogRoutes: MetadataRoute.Sitemap = [];
  for (const blog of blogs) {
    const href = await canonicalBlogHref(blog);
    if (href) blogRoutes.push({ url: `${baseUrl}${href}`, lastModified: blog.updatedAt, changeFrequency: "weekly", priority: 0.8 });
  }

  // Exams
  const exams = await db.exam.findMany({
    select: { slug: true },
  });

  const examRoutes: MetadataRoute.Sitemap = exams.map((e) => ({
    url: `${baseUrl}/exams/${e.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const sectionRoutes: MetadataRoute.Sitemap = (await getCustomNavbarFilters(true)).map(section => ({ url: `${baseUrl}${section.href}`, changeFrequency: "daily", priority: 0.8 }));

  return [...sectionRoutes, ...staticRoutes, ...collegeRoutes, ...programmeRoutes, ...blogRoutes, ...examRoutes];
}

