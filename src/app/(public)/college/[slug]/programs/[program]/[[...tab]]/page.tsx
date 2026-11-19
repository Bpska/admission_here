import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { programKey, collegeProgramHref, PROGRAM_TABS } from "@/lib/college-programs";
import { constructSeoMetadata } from "@/lib/seo/metadata";
import { CollegeCoursesContent } from "@/components/college/CollegeCoursesContent";
import { CollegeCutoffContent } from "@/components/college/CollegeCutoffContent";
import { CollegeRankingsContent } from "@/components/college/CollegeRankingsContent";
import { CollegeGalleryContent } from "@/components/college/CollegeGalleryContent";
import { CollegeReviewsContent } from "@/components/college/CollegeReviewsContent";
import { CollegeQnaContent } from "@/components/college/CollegeQnaContent";
import { CollegeBlogsContent } from "@/components/college/CollegeBlogsContent";
import { getCollegeBlogPosts } from "@/lib/college-blogs";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string; program: string; tab?: string[] }> };
const getProfile = cache(async (slug: string, program: string) => {
  if (!/^[a-z0-9-]{1,100}$/.test(program)) notFound();
  const college = await db.college.findUnique({ where: { slug, isPublished: true }, include: {
    courses: { include: { course: true, cutoffs: { include: { exam: true }, orderBy: [{ academicYear: "desc" }, { counselingRound: "asc" }] } } },
    rankings: { orderBy: { rankingYear: "desc" } },
    reviews: { where: { moderationStatus: "APPROVED" }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
  } });
  if (!college) notFound();
  const courses = college.courses.filter(offering => programKey(offering.course.degree) === program);
  if (!courses.length) notFound();
  return { ...college, courses };
});
const tabLabel: Record<string, string> = { "": "Overview", "courses-fees": "Courses & Fees", admission: "Admission & Eligibility", cutoff: "Cutoffs", placements: "Placements", rankings: "Rankings", gallery: "Campus Gallery", reviews: "Student Reviews", qna: "Questions & Answers", blogs: "College Blogs" };
export async function generateMetadata({ params }: Props) {
  const { slug, program, tab = [] } = await params;
  if (tab.length > 1 || !PROGRAM_TABS.includes(tab[0] || "")) notFound();
  const college = await getProfile(slug, program); const label = college.courses[0].course.degree;
  return constructSeoMetadata({ title: `${college.name} ${label}: ${tabLabel[tab[0] || ""]}`, description: `Explore ${label} at ${college.name}: programme fees, eligibility, admission, cutoffs and available placement information.`, canonicalPath: ["gallery", "qna", "blogs"].includes(tab[0] || "") ? `/college/${slug}/${tab[0]}` : collegeProgramHref(slug, program, tab[0]), keywords: [label, college.name, `${label} fees`, `${label} admission`] });
}
function HtmlSection({ title, html }: { title: string; html: string }) { return <section className="space-y-3 rounded-xl border bg-card p-5"><h2 className="text-lg font-bold">{title}</h2><div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: html }} /></section>; }
export default async function CollegeProgramPage({ params }: Props) {
  const { slug, program, tab = [] } = await params;
  if (tab.length > 1 || !PROGRAM_TABS.includes(tab[0] || "")) notFound();
  const college = await getProfile(slug, program); const label = college.courses[0].course.degree;
  const section = tab[0] || ""; const base = collegeProgramHref(slug, program);
  const eligibility = <section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-lg font-bold">{label} eligibility &amp; entrance exams</h2>{college.courses.map(offering => {
    const criteria = offering.eligibilityCriteria as { description?: string; min_12th_pct?: number; mandatory_subjects?: string[] } | null;
    return <div key={offering.id} className="space-y-2 border-t pt-3 first:border-0 first:pt-0"><h3 className="font-semibold">{offering.specialization}</h3>{criteria?.description ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{criteria.description}</p> : <p className="text-sm text-muted-foreground">Detailed eligibility has not been published here. Confirm the current {label} requirements with the college.</p>}{criteria?.min_12th_pct != null && <p className="text-sm">Minimum Class 12 percentage: {criteria.min_12th_pct}%</p>}{criteria?.mandatory_subjects?.length ? <p className="text-sm">Required subjects: {criteria.mandatory_subjects.join(", ")}</p> : null}<p className="text-sm">Accepted exams: {offering.acceptedExamSlugs.length ? offering.acceptedExamSlugs.join(", ").toUpperCase() : "Not published for this programme"}</p>{offering.syllabusPdfUrl && <a href={offering.syllabusPdfUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Programme syllabus</a>}</div>;
  })}</section>;
  const admissions = <section className="space-y-4"><h2 className="text-xl font-bold">{college.name} {label} admission</h2>{college.courses.some(offering => offering.programAdmissionHtml) ? college.courses.map(offering => offering.programAdmissionHtml && <HtmlSection key={offering.id} title={offering.specialization} html={offering.programAdmissionHtml} />) : <p className="rounded-xl border p-5 text-sm text-muted-foreground">{label}-specific application instructions and dates have not been added. Contact the college for the current programme admission process.</p>}</section>;
  let content;
  if (section === "courses-fees") content = <><CollegeCoursesContent college={college} />{eligibility}</>;
  else if (section === "admission") content = <>{admissions}{eligibility}</>;
  else if (section === "cutoff") content = <CollegeCutoffContent college={college} />;
  else if (section === "placements") content = <section className="space-y-4"><h2 className="text-xl font-bold">{college.name} {label} placements</h2>{college.courses.some(offering => offering.programPlacementHtml) ? college.courses.map(offering => offering.programPlacementHtml && <HtmlSection key={offering.id} title={offering.specialization} html={offering.programPlacementHtml} />) : <p className="rounded-xl border p-5 text-sm text-muted-foreground">{label}-specific placement data has not been added. College-wide or other programme figures are not presented as {label} placements.</p>}</section>;
  else if (section === "rankings") content = <><p className="text-sm text-muted-foreground">Rankings below are for the applicable discipline or the institution overall. An overall college ranking is not a separate {label} ranking.</p><CollegeRankingsContent college={{ ...college, rankings: college.rankings.filter(ranking => ["overall", label.toLowerCase(), ...college.courses.map(offering => offering.course.stream.toLowerCase())].includes(ranking.category.toLowerCase())) }} /></>;
  else if (section === "gallery") content = <><p className="text-sm text-muted-foreground">Shared college campus and facilities for all programmes.</p><CollegeGalleryContent college={college} /></>;
  else if (section === "reviews") {
    const degreeExpression = new RegExp(`(^|[^a-z0-9])${label.replace(/[^a-z0-9]/gi, "").split("").join("[.\\s-]*")}([^a-z0-9]|$)`, "i");
    const reviews = college.reviews.filter(review => degreeExpression.test(review.courseName));
    content = <CollegeReviewsContent college={{ ...college, reviews, reviewCount: reviews.length, ratingOverall: reviews.length ? reviews.reduce((sum, review) => sum + review.ratingOverall, 0) / reviews.length : 0 }} />;
  } else if (section === "qna") content = <><p className="text-sm text-muted-foreground">College-wide questions and campus information. Programme requirements are listed under Admission.</p><CollegeQnaContent college={college} /></>;
  else if (section === "blogs") content = <><p className="text-sm text-muted-foreground">Articles about this college, shared across programmes.</p><CollegeBlogsContent collegeName={college.name} collegeSlug={college.slug} posts={await getCollegeBlogPosts(college)} /></>;
  else content = <>
    <section className="rounded-xl border bg-card p-5"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Programme profile</p><h2 className="mt-2 text-2xl font-bold">{college.name} — {label}</h2><p className="mt-2 text-sm text-muted-foreground">Explore only the {label} programmes offered here. Switch programmes above to compare another course at the same college.</p></section>
    {college.courses.map(offering => offering.programOverviewHtml && <HtmlSection key={offering.id} title={`${label}: ${offering.specialization}`} html={offering.programOverviewHtml} />)}
    <CollegeCoursesContent college={college} />{eligibility}{admissions}
    <div className="flex flex-wrap gap-3 text-sm font-semibold"><Link href={`${base}/cutoff`} className="rounded-lg border p-3 text-primary">View {label} cutoffs</Link><Link href={`${base}/placements`} className="rounded-lg border p-3 text-primary">View {label} placements</Link></div>
    <section className="space-y-3 rounded-xl border bg-card p-5"><h2 className="text-lg font-bold">College &amp; campus information</h2><p className="text-sm text-muted-foreground">{college.name}, {college.city}, {college.state}. Campus details are shared by all programmes.</p>{college.fullAddress && <p className="text-sm">{college.fullAddress}</p>}{college.estYear && <p className="text-sm">Established: {college.estYear}</p>}{college.approvedBy.length > 0 && <p className="text-sm">Institutional approvals: {college.approvedBy.join(", ")}</p>}<Link href={`${base}/gallery`} className="inline-block text-sm font-semibold text-primary">View campus gallery →</Link></section>
  </>;
  return <div className="space-y-6">{content}</div>;
}
