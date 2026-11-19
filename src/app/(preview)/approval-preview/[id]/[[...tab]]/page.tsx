import { CollegeInitialBlogSchema } from "@/lib/college-initial-blog";
import { BlogProse } from "@/components/blog/BlogProse";
import { getCollegeBlogPosts } from "@/lib/college-blogs";
import { CollegeBlogsContent } from "@/components/college/CollegeBlogsContent";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadApprovalCollege } from "@/lib/approval-college";
import { Navbar } from "@/components/public/Navbar";
import { Footer } from "@/components/public/Footer";
import { CollegeHeaderClient } from "@/app/(public)/college/[slug]/CollegeHeaderClient";
import { CollegeOverviewContent } from "@/components/college/CollegeOverviewContent";
import { CollegeAdmissionContent } from "@/components/college/CollegeAdmissionContent";
import { CollegeCoursesContent } from "@/components/college/CollegeCoursesContent";
import { CollegeCutoffContent } from "@/components/college/CollegeCutoffContent";
import { CollegePlacementsContent } from "@/components/college/CollegePlacementsContent";
import { CollegeRankingsContent } from "@/components/college/CollegeRankingsContent";
import { CollegeGalleryContent } from "@/components/college/CollegeGalleryContent";
import { CollegeReviewsContent } from "@/components/college/CollegeReviewsContent";
import { CollegeQnaContent } from "@/components/college/CollegeQnaContent";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "College submission preview", robots: { index: false, follow: false } };
export default async function ApprovalPreviewPage({ params }: { params: Promise<{ id: string; tab?: string[] }> }) {
  const { id, tab = [] } = await params;
  if (tab.length > 1) notFound();
  const { college, request } = await loadApprovalCollege(id);
  const basePath = `/approval-preview/${id}`;
  let content;
  switch (tab[0] || "") {
    case "": content = <CollegeOverviewContent college={college} relatedColleges={[]} previewBasePath={basePath} />; break;
    case "courses-fees": content = <CollegeCoursesContent college={college} />; break;
    case "admission": content = <CollegeAdmissionContent college={college} />; break;
    case "cutoff": content = <CollegeCutoffContent college={college} />; break;
    case "placements": content = <CollegePlacementsContent college={college} />; break;
    case "rankings": content = <CollegeRankingsContent college={college} />; break;
    case "gallery": content = <CollegeGalleryContent college={college} />; break;
    case "reviews": content = <CollegeReviewsContent college={college} preview />; break;
    case "blogs": {
      const proposed = request.proposedData as Record<string, unknown>;
      const initial = proposed.initialBlog ? CollegeInitialBlogSchema.parse(proposed.initialBlog) : null;
      content = <div className="space-y-6">
        {initial && <section className="space-y-4 rounded-xl border bg-card p-6">
          <p className="text-xs font-semibold text-amber-700">Submitted college blog — {initial.publish && college.isPublished ? "publish after approval" : "save as draft"}</p>
          <h1 className="text-2xl font-bold">{initial.title}</h1>
          {initial.featuredImageUrl && <img src={initial.featuredImageUrl} alt="Submitted blog cover" className="max-h-80 w-full rounded-xl object-contain" />}
          <BlogProse content={initial.contentMdx} />
        </section>}
        <CollegeBlogsContent collegeName={college.name} posts={await getCollegeBlogPosts(college)} />
      </div>;
      break;
    }
    case "qna": content = <CollegeQnaContent college={college} />; break;
    default: notFound();
  }
  return <div className="min-h-screen bg-background">
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-900">Submission preview — not published. Application and brochure requests are disabled.</div>
    <Navbar />
    <CollegeHeaderClient college={college} previewBasePath={basePath} />
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">{content}</main>
    <Footer />
  </div>;
}
