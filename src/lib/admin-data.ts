import { z } from "zod";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { collegeSlugSchema, slugifyCollegeName } from "./college-slug";

const int = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const year = z.number().int().min(2000).max(2100);
const text = z.string().trim().min(1);
const optionalText = z.string().trim().nullable().optional();
const date = z.coerce.date().nullable().optional();
export const DATA_SCHEMAS = {
  exams: z.object({ name: text, slug: collegeSlugSchema, conductingBody: text, stream: text, examLevel: z.enum(["National", "State", "University"]), applicationStart: date, applicationEnd: date, examDate: date, resultDate: date, overviewHtml: text, syllabusHtml: optionalText, durationMinutes: int.min(1).nullable().optional(), totalMarks: int.min(1).nullable().optional(), examMode: optionalText, counselingSchedule: optionalText }),
  courses: z.object({ slug: collegeSlugSchema, stream: text, degree: text, fullName: text, durationYrs: z.number().min(0.25).max(15).nullable(), level: z.enum(["UG", "PG", "Diploma", "Doctoral"]) }),
  offerings: z.object({ courseId: z.string().uuid().nullable().optional(), courseName: text.max(200).optional(), degree: text.max(100).optional(), stream: text.max(100).optional(), durationYrs: z.number().min(0.25).max(15).nullable().optional(), level: z.enum(["UG", "PG", "Diploma", "Doctoral"]).optional(), programOverviewHtml: optionalText, programAdmissionHtml: optionalText, programPlacementHtml: optionalText, specialization: text, totalFeesInr: int.nullable().optional(), publishedFeeInr: int.nullable().optional(), publishedCreditFeeInr: int.nullable().optional(), feeBasis: optionalText, feeAcademicYear: optionalText, feeSourceUrl: optionalText, firstYearFeesInr: int.nullable().optional(), hostelFeesYearlyInr: int.nullable().optional(), intakeSeats: int.nullable().optional(), acceptedExamSlugs: z.array(text).default([]), minimumClass12Percent: z.number().min(0).max(100).nullable().optional(), eligibilityDescription: optionalText, syllabusPdfUrl: optionalText }),
  cutoffs: z.object({ examId: z.string().uuid(), collegeCourseId: z.string().uuid(), academicYear: year, counselingRound: int.min(1), category: z.enum(["GEN", "OBC", "SC", "ST", "EWS"]), quota: z.enum(["AI", "HS", "OS"]), gender: z.enum(["Gender-Neutral", "Female-only"]), openingRank: int.min(1).nullable().optional(), closingRank: int.min(1).nullable().optional(), cutoffPercentile: z.number().min(0).max(100).nullable().optional() }),
  placements: z.object({ batchYear: year, highestPackageInr: int.nullable().optional(), averagePackageInr: int.nullable().optional(), medianPackageInr: int.nullable().optional(), placementPercentage: z.number().min(0).max(100).nullable().optional(), sourceUrl: optionalText, sourceNote: optionalText, totalOffers: int.nullable().optional(), topRecruiters: z.array(text).default([]), photoUrls: z.array(z.string().regex(/^\/api\/v1\/blog-images\/[a-f0-9-]{36}$/i, "Upload placement photos using the file picker.")).max(100).optional() }),
  rankings: z.object({ agencyName: text, category: text, rankingYear: year, rankNumber: int.min(1), outOfTotal: int.min(1).nullable().optional() }),
  users: z.object({ name: text, email: z.string().trim().toLowerCase().email(), phone: optionalText, role: z.enum(["STUDENT", "AUTHOR", "COLLEGE_ADMIN", "SUPER_ADMIN"]), managedCollegeId: z.string().uuid().nullable().optional(), password: z.string().min(8).optional(), isActive: z.boolean().default(true) }),
};
export type DataResource = keyof typeof DATA_SCHEMAS;
export const DATA_MODELS: Record<DataResource, string> = { exams: "exam", courses: "course", offerings: "collegeCourse", cutoffs: "examCutoff", placements: "placementStat", rankings: "agencyRanking", users: "user" };
export type DataMutation = { resource: DataResource; operation: "create" | "update" | "delete"; id?: string; collegeId?: string; data: Record<string, any> };

export function parseDataMutation(resource: DataResource, operation: DataMutation["operation"], data: unknown) {
  const schema = DATA_SCHEMAS[resource];
  const result = operation === "delete" ? {} : (operation === "update" ? schema.partial() : schema).parse(data) as Record<string, any>;
  if (result.openingRank && result.closingRank && result.openingRank > result.closingRank) throw new Error("Opening rank must not exceed closing rank.");
  if (result.applicationStart && result.applicationEnd && result.applicationStart > result.applicationEnd) throw new Error("Applications must close after they open.");
  return result;
}

/** All mutations run inside the caller's transaction, including approved staff changes. */
export async function applyDataMutation(tx: Prisma.TransactionClient, mutation: DataMutation, actorId: string) {
  const { resource, operation, id, collegeId } = mutation;
  const model = (tx as any)[DATA_MODELS[resource]];
  let existing: any;
  if (operation !== "create") {
    existing = await model.findUnique({ where: { id } });
    if (!existing) throw new Error("Record no longer exists.");
    if (["offerings", "placements", "rankings"].includes(resource) && existing.collegeId !== collegeId) throw new Error("Record belongs to another college.");
    if (resource === "cutoffs") {
      const offering = await tx.collegeCourse.findUnique({ where: { id: existing.collegeCourseId } });
      if (offering?.collegeId !== collegeId) throw new Error("Cutoff belongs to another college.");
    }
  }
  const parsed = parseDataMutation(resource, operation, mutation.data);
  const data: any = { ...parsed };
  if (resource === "users") {
    if (existing?.role === "STAFF") throw new Error("Manage staff accounts in Staff Management.");
    if (existing?.id === actorId && (operation === "delete" || data.isActive === false || (data.role && data.role !== "SUPER_ADMIN"))) throw new Error("You cannot delete, disable or demote your own account.");
    if (existing?.role === "SUPER_ADMIN" && existing.isActive && (operation === "delete" || data.isActive === false || (data.role && data.role !== "SUPER_ADMIN"))) {
      if (await tx.user.count({ where: { role: "SUPER_ADMIN", isActive: true } }) <= 1) throw new Error("At least one active Super Administrator must remain.");
    }
    if (operation === "create" && !data.password) throw new Error("A password of at least 8 characters is required for new accounts.");
    if (data.role === "COLLEGE_ADMIN" && !data.managedCollegeId) throw new Error("Select the partner's managed college.");
    if (data.password) data.passwordHash = await bcrypt.hash(data.password, 10);
    delete data.password;
  }
  if (resource === "exams" && operation !== "delete") {
    const pattern = { ...(existing?.patternJson || {}) };
    for (const key of ["durationMinutes", "totalMarks", "examMode", "counselingSchedule"]) {
      if (key in data) { if (data[key] === null || data[key] === "") delete pattern[key]; else pattern[key] = data[key]; delete data[key]; }
    }
    data.patternJson = pattern;
  }
  if (resource === "offerings" && operation !== "delete") {
    const details = ["courseName", "degree", "stream", "durationYrs", "level"];
    const hasDetails = details.some(key => data[key] !== undefined);
    if (hasDetails) {
      if (!["courseName", "degree", "stream", "level"].every(key => data[key] !== undefined && data[key] !== "" && data[key] !== null)) throw new Error("Enter the course name, degree, stream and level.");
      const courseData = { fullName: data.courseName, degree: data.degree, stream: data.stream, durationYrs: data.durationYrs ?? null, level: data.level };
      const matching = await tx.course.findFirst({ where: courseData });
      if (matching) data.courseId = matching.id;
      else {
        // Reuse identical typed degrees; never overwrite a shared catalog course.
        const hash = createHash("sha256").update(JSON.stringify(courseData)).digest("hex").slice(0, 12);
        const prefix = slugifyCollegeName(`${data.degree}-${data.courseName}`).slice(0, 65).replace(/-+$/, "") || "course";
        const course = await tx.course.upsert({ where: { slug: `${prefix}-${hash}` }, create: { ...courseData, slug: `${prefix}-${hash}` }, update: {} });
        data.courseId = course.id;
      }
    }
    if (!data.courseId && (operation === "create" || "courseId" in data)) throw new Error("Enter course details or select an existing course.");
    for (const key of details) delete data[key];
    const eligibility = { ...(existing?.eligibilityCriteria || {}) };
    if ("minimumClass12Percent" in data) eligibility.min_12th_pct = data.minimumClass12Percent;
    if ("eligibilityDescription" in data) eligibility.description = data.eligibilityDescription;
    delete data.minimumClass12Percent; delete data.eligibilityDescription;
    data.eligibilityCriteria = eligibility;
  }
  if (resource === "cutoffs" && operation !== "delete") {
    const offering = await tx.collegeCourse.findUnique({ where: { id: data.collegeCourseId || existing?.collegeCourseId } });
    if (offering?.collegeId !== collegeId) throw new Error("Select a course belonging to this college.");
  }
  if (operation === "delete") {
    if (resource === "offerings" && await tx.examCutoff.count({ where: { collegeCourseId: id } })) throw new Error("Delete this course's cutoff records first.");
    if (resource === "exams" && await tx.examCutoff.count({ where: { examId: id } })) throw new Error("Delete linked cutoffs before deleting this exam.");
    if (resource === "courses" && await tx.collegeCourse.count({ where: { courseId: id } })) throw new Error("Remove college course mappings before deleting this catalog course.");
    await model.delete({ where: { id } }); return { id };
  }
  if (operation === "create" && ["offerings", "placements", "rankings"].includes(resource)) data.collegeId = collegeId;
  return operation === "create" ? model.create({ data }) : model.update({ where: { id }, data });
}
