import "server-only";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkAdminAccess } from "@/lib/auth/staff-guard";
import { CollegeCreateSchema, CollegeUpdateSchema } from "@/lib/college-validation";

const profileInclude = {
  courses: { include: { course: true, cutoffs: { include: { exam: true }, orderBy: [{ academicYear: "desc" }, { counselingRound: "asc" }] } }, orderBy: { totalFeesInr: "asc" } },
  placements: { orderBy: { batchYear: "desc" } },
  rankings: { orderBy: [{ rankingYear: "desc" }, { rankNumber: "asc" }] },
  reviews: { where: { moderationStatus: "APPROVED" }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
} satisfies Prisma.CollegeInclude;
export type ApprovalCollege = Prisma.CollegeGetPayload<{ include: typeof profileInclude }>;

export async function loadApprovalCollege(requestId: string, sanitizeContent = true) {
  const access = await checkAdminAccess("colleges");
  if (!access.allowed || !z.string().uuid().safeParse(requestId).success) notFound();
  const request = await db.collegeApprovalRequest.findUnique({ where: { id: requestId } });
  if (!request || (!access.isSuperAdmin && request.staffId !== access.userId)) notFound();
  const proposed = request.proposedData as Record<string, unknown>;
  const existing = request.collegeId ? await db.college.findUnique({ where: { id: request.collegeId }, include: profileInclude }) : null;
  if (request.collegeId && !existing) notFound();
  const blank: ApprovalCollege = {
    id: request.id, slug: "preview", name: "New college", shortName: null, city: "", state: "",
    logoUrl: null, coverImageUrl: null, brochurePdfUrl: null, pincode: null, latitude: null, longitude: null,
    estYear: null, ownershipType: "PUBLIC_GOVERNMENT", affiliatedTo: null, approvedBy: [], naacGrade: null,
    nirfRank: null, campusAreaAcres: null, overviewHtml: "", admissionHtml: null, facilitiesJson: null,
    galleryUrls: [], faqsJson: null, qnaJson: null, fullAddress: null, websiteUrl: null, contactPhone: null,
    contactEmail: null, scholarshipInfo: null, hostelInfo: null, metaTitle: null, metaDescription: null,
    ratingOverall: 0, reviewCount: 0, isFeatured: false, isPublished: false, showInNavbar: false, navbarCategory: null, navbarSection: "featured", navbarFilter: null, embedding: null,
    createdAt: request.createdAt, updatedAt: request.updatedAt, courses: [], placements: [], rankings: [], reviews: [],
  };
  const fields = proposed.__resourceMutation ? {} : request.actionType === "CREATE"
    ? CollegeCreateSchema.parse(proposed) : CollegeUpdateSchema.parse(proposed);
  const college = { ...(existing || blank), ...fields } as ApprovalCollege;
  // Show related records from a new-college proposal in every preview tab.
  if (request.actionType === "CREATE" && !proposed.__resourceMutation) {
    const draft = CollegeCreateSchema.parse(proposed).onboardingData;
    if (draft) {
      const [catalog, exams] = await Promise.all([
        db.course.findMany({ where: { id: { in: draft.offerings.map(row => row.courseId).filter((id): id is string => Boolean(id)) } } }),
        db.exam.findMany({ where: { id: { in: draft.cutoffs.map(row => row.examId) } } }),
      ]);
      college.courses = draft.offerings.map(row => ({
        id: row.clientId, collegeId: college.id, courseId: row.courseId || row.clientId,
        programOverviewHtml: row.programOverviewHtml ?? null, programAdmissionHtml: row.programAdmissionHtml ?? null, programPlacementHtml: row.programPlacementHtml ?? null,
        specialization: row.specialization, totalFeesInr: row.totalFeesInr ?? null, publishedFeeInr: row.publishedFeeInr ?? null, publishedCreditFeeInr: row.publishedCreditFeeInr ?? null, feeBasis: row.feeBasis ?? null, feeAcademicYear: row.feeAcademicYear ?? null, feeSourceUrl: row.feeSourceUrl ?? null,
        firstYearFeesInr: row.firstYearFeesInr ?? null, hostelFeesYearlyInr: row.hostelFeesYearlyInr ?? null,
        intakeSeats: row.intakeSeats ?? null, acceptedExamSlugs: row.acceptedExamSlugs,
        eligibilityCriteria: { min_12th_pct: row.minimumClass12Percent ?? null, description: row.eligibilityDescription ?? null },
        syllabusPdfUrl: row.syllabusPdfUrl ?? null,
        course: row.courseName ? { id: row.clientId, slug: "preview", fullName: row.courseName, degree: row.degree!, stream: row.stream!, durationYrs: row.durationYrs ?? null, level: row.level! } : catalog.find(course => course.id === row.courseId)!,
        cutoffs: draft.cutoffs.filter(cutoff => cutoff.collegeCourseId === row.clientId).map((cutoff, index) => ({
          ...cutoff, id: `preview-cutoff-${index}`, openingRank: cutoff.openingRank ?? null,
          closingRank: cutoff.closingRank ?? null, cutoffPercentile: cutoff.cutoffPercentile ?? null,
          exam: exams.find(exam => exam.id === cutoff.examId)!,
        })),
      })).filter(row => row.course) as ApprovalCollege["courses"];
      college.placements = draft.placements.map((row, index) => ({
        ...row, photoUrls: row.photoUrls || [], id: `preview-placement-${index}`, collegeId: college.id,
        highestPackageInr: row.highestPackageInr == null ? null : BigInt(row.highestPackageInr), averagePackageInr: row.averagePackageInr == null ? null : BigInt(row.averagePackageInr),
        medianPackageInr: row.medianPackageInr == null ? null : BigInt(row.medianPackageInr), placementPercentage: row.placementPercentage ?? null, sourceUrl: row.sourceUrl ?? null, sourceNote: row.sourceNote ?? null, totalOffers: row.totalOffers ?? null,
      }));
      college.rankings = draft.rankings.map((row, index) => ({ ...row, id: `preview-ranking-${index}`, collegeId: college.id, outOfTotal: row.outOfTotal ?? null }));
    }
  }
  // Staff HTML must not execute scripts in the administrator's preview session.
  for (const key of ["overviewHtml", "admissionHtml", "hostelInfo", "scholarshipInfo"] as const) {
    const html = college[key];
    if (html && sanitizeContent) college[key] = sanitizeHtml(html);
  }
  return { request, college, isSuperAdmin: access.isSuperAdmin };
}
