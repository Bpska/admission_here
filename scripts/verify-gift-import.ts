import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import source from "../src/data/college-imports/gift.json";
import { generateCourseJsonLd } from "../src/lib/seo/json-ld";
import { getCollegeBlogPosts } from "../src/lib/college-blogs";
const db = new PrismaClient();
async function main() {
  const college = await db.college.findUniqueOrThrow({ where: { slug: source.college.slug }, include: { courses: { include: { course: true } }, placements: { orderBy: { batchYear: "desc" } }, rankings: true, reviews: true } });
  assert.equal(college.isPublished, true); assert.equal(college.courses.length, 36); assert.equal(college.galleryUrls.length, 4);
  assert.equal(college.naacGrade, "A++"); assert.equal(college.nirfRank, null); assert.equal(college.campusAreaAcres, null);
  assert.equal(college.rankings.length, 0); assert.equal(college.reviews.length, 0);
  const cse = college.courses.find(row => row.course.degree === "B.Tech" && row.specialization === "Computer Science and Engineering")!;
  assert.equal(cse.totalFeesInr, null); assert.equal(cse.firstYearFeesInr, null); assert.equal(cse.publishedFeeInr, 124000);
  assert.equal(cse.intakeSeats, 360); assert.equal(cse.feeAcademicYear, "2026");
  assert.match(cse.feeBasis!, /does not specify/);
  const schema = generateCourseJsonLd({ courseName: cse.specialization, degree: cse.course.degree, collegeName: college.name, totalFeesInr: cse.totalFeesInr, durationYrs: cse.course.durationYrs, slug: college.slug });
  assert.equal('offers' in schema, false, "Do not emit a made-up tuition price in search engine metadata");
  assert.equal(college.placements.length, 3);
  assert.equal(Number(college.placements[0].medianPackageInr), 513000);
  assert.equal(college.placements[0].highestPackageInr, null); assert.equal(college.placements[0].averagePackageInr, null); assert.equal(college.placements[0].totalOffers, null);
  assert.ok(college.placements[0].sourceNote?.includes("595")); assert.ok(college.placements[0].sourceNote?.includes("661"));
  assert.equal((await getCollegeBlogPosts(college, undefined, db)).length, 1);
  const ids = [...new Set([college.logoUrl, college.coverImageUrl, ...college.galleryUrls].filter((url): url is string => Boolean(url)).map(url => url.split('/').pop()!))];
  const images = await db.blogImage.findMany({ where: { id: { in: ids } }, select: { size: true } });
  assert.equal(images.length, 5); assert.ok(images.every(image => image.size > 0 && image.size <= 3 * 1024 * 1024));
  console.log('GIFT verified: 36 courses, explicitly qualified 2026 fees and 2025–26 intakes, 3 sourced placement cohorts, 4 campus photos, published linked blog, and no invented tuition totals, ranks or reviews.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
