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
  // Staff HTML must not execute scripts in the administrator's preview session.
  for (const key of ["overviewHtml", "admissionHtml", "hostelInfo", "scholarshipInfo"] as const) {
    const html = college[key];
    if (html && sanitizeContent) college[key] = sanitizeHtml(html);
  }
  return { request, college, isSuperAdmin: access.isSuperAdmin };
}
