import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { CollegeCreateSchema } from "../src/lib/college-validation";
import { applyDataMutation } from "../src/lib/admin-data";
import { createCollegeProfile } from "../src/lib/create-college-profile";

const db = new PrismaClient();
const marker = `qa-onboarding-${randomUUID()}`;
const reference = randomUUID();
const makeInput = (courseId: string, examId: string) => ({
  name: "Onboarding verification college", slug: marker, city: "Bhubaneswar", state: "Odisha", ownershipType: "PRIVATE", isPublished: false,
  affiliatedTo: "Verification university", approvedBy: ["AICTE"], admissionHtml: "<p>Verified admission details</p>",
  faqsJson: [{ question: "How can I apply?", answer: "Contact the admissions office." }],
  onboardingData: {
    offerings: [{ clientId: reference, courseId, specialization: "Computer Science", totalFeesInr: 400000, firstYearFeesInr: 100000, intakeSeats: 60, acceptedExamSlugs: [marker], minimumClass12Percent: 60 }],
    cutoffs: [{ collegeCourseId: reference, examId, academicYear: 2026, counselingRound: 1, category: "GEN", quota: "AI", gender: "Gender-Neutral", openingRank: 100, closingRank: 1000 }],
    placements: [{ batchYear: 2026, highestPackageInr: 1500000, averagePackageInr: 700000, medianPackageInr: 600000, placementPercentage: 80, totalOffers: 40, topRecruiters: ["Verified recruiter"] }],
    rankings: [{ agencyName: "Verification agency", category: "Engineering", rankingYear: 2026, rankNumber: 20, outOfTotal: 100 }],
  },
});
async function main() {
  const sample = makeInput(randomUUID(), randomUUID());
  assert.equal(CollegeCreateSchema.safeParse(sample).success, true);
  const invalid = structuredClone(sample); invalid.onboardingData.cutoffs[0].collegeCourseId = randomUUID();
  assert.equal(CollegeCreateSchema.safeParse(invalid).success, false, "Reject a cutoff pointing outside the new college's courses");
  const badRank = structuredClone(sample); badRank.onboardingData.cutoffs[0].openingRank = 2000;
  assert.equal(CollegeCreateSchema.safeParse(badRank).success, false, "Reject reversed rank ranges");
  const badFaq = { ...sample, faqsJson: [{ question: "", answer: "Answer" }] };
  assert.equal(CollegeCreateSchema.safeParse(badFaq).success, false, "Reject incomplete Q&A");
  // All verification fixtures are rolled back; no demo records are left behind.
  try {
    await db.$transaction(async tx => {
      const course = await tx.course.create({ data: { slug: marker, stream: "Engineering", degree: "B.Tech", fullName: "Verification degree", durationYrs: 4, level: "UG" } });
      const exam = await tx.exam.create({ data: { slug: marker, name: "Verification exam", conductingBody: "Verification body", stream: "Engineering", examLevel: "National", overviewHtml: "Verification" } });
      const college = await createCollegeProfile(tx, makeInput(course.id, exam.id), randomUUID());
      const saved = await tx.college.findUniqueOrThrow({ where: { id: college.id }, include: { courses: { include: { cutoffs: true } }, placements: true, rankings: true } });
      assert.equal(saved.courses.length, 1); assert.equal(saved.courses[0].cutoffs.length, 1);
      assert.notEqual(saved.courses[0].id, reference, "Map draft IDs to actual database IDs");
      assert.equal(saved.courses[0].cutoffs[0].collegeCourseId, saved.courses[0].id);
      assert.equal(saved.placements.length, 1); assert.equal(saved.rankings.length, 1);
      assert.equal(saved.affiliatedTo, sample.affiliatedTo); assert.deepEqual(saved.faqsJson, sample.faqsJson);
      assert.equal(saved.isPublished, false);
      const typedDetails = { courseName: `Typed degree ${marker}`, degree: "B.Tech", stream: "Engineering", durationYrs: 4, level: "UG", specialization: "Artificial Intelligence", totalFeesInr: 450000, firstYearFeesInr: 120000, hostelFeesYearlyInr: 60000, intakeSeats: 60, acceptedExamSlugs: ["jee-main"], minimumClass12Percent: 60, eligibilityDescription: "Physics, Chemistry and Mathematics" };
      const typedProfile = makeInput(course.id, exam.id);
      const { courseId: _ignored, ...offeringInput } = typedProfile.onboardingData.offerings[0];
      const typedPayload = { ...typedProfile, slug: `${marker}-typed`, onboardingData: { ...typedProfile.onboardingData, offerings: [{ ...offeringInput, ...typedDetails }] } };
      assert.equal(CollegeCreateSchema.safeParse(typedPayload).success, true);
      const typedCollege = await createCollegeProfile(tx, typedPayload, randomUUID());
      const newOffering = await tx.collegeCourse.findFirstOrThrow({ where: { collegeId: typedCollege.id }, include: { course: true, cutoffs: true } });
      assert.equal(newOffering.course.fullName, typedDetails.courseName);
      assert.equal(newOffering.cutoffs.length, 1, "New-college cutoffs link to a directly typed course");
      const typed = await applyDataMutation(tx, { resource: "offerings", operation: "create", collegeId: college.id, data: typedDetails }, randomUUID());
      const typedSaved = await tx.collegeCourse.findUniqueOrThrow({ where: { id: typed.id }, include: { course: true } });
      assert.equal(typedSaved.course.fullName, typedDetails.courseName);
      assert.equal(typedSaved.course.degree, "B.Tech"); assert.equal(typedSaved.course.durationYrs, 4);
      assert.equal(typedSaved.totalFeesInr, 450000); assert.equal(typedSaved.hostelFeesYearlyInr, 60000);
      assert.equal((typedSaved.eligibilityCriteria as any).description, typedDetails.eligibilityDescription);
      const updated = await applyDataMutation(tx, { resource: "offerings", operation: "update", id: typed.id, collegeId: college.id, data: { ...typedDetails, totalFeesInr: 480000 } }, randomUUID());
      assert.equal(updated.totalFeesInr, 480000); assert.equal(updated.courseId, typedSaved.courseId, "Repeated saves reuse the matching degree");
      const revised = await applyDataMutation(tx, { resource: "offerings", operation: "update", id: typed.id, collegeId: college.id, data: { ...typedDetails, durationYrs: 3 } }, randomUUID());
      assert.notEqual(revised.courseId, typedSaved.courseId);
      assert.equal((await tx.course.findUniqueOrThrow({ where: { id: typedSaved.courseId } })).durationYrs, 4, "Editing college course details does not rewrite a shared catalog degree");
      throw Error("VERIFY_ROLLBACK");
    }, { timeout: 30000 });
  } catch (error) { if (!(error instanceof Error) || error.message !== "VERIFY_ROLLBACK") throw error; }
  await assert.rejects(db.$transaction(tx => createCollegeProfile(tx, makeInput(randomUUID(), randomUUID()), randomUUID())), "A missing referenced course must roll back the whole college creation");
  assert.equal(await db.college.count({ where: { slug: marker } }), 0);
  assert.equal(await db.course.count({ where: { slug: marker } }), 0);
  assert.equal(await db.exam.count({ where: { slug: marker } }), 0);
  console.log("College onboarding passed: typed courses, fee save/reload/update, matching degree reuse, shared catalog protection, initial course/cutoff mapping, validation, and rollback. No test data retained.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
