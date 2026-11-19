import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import source from "../src/data/college-imports/nalanda.json";
import { applyDataMutation, parseDataMutation } from "../src/lib/admin-data";
const db = new PrismaClient();
async function main() {
  const report = await db.$transaction(async tx => {
    const college = await tx.college.findUniqueOrThrow({ where: { slug: source.college.slug }, include: { courses: { include: { course: true } } } });
    const admin = await tx.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN", isActive: true } });
    const created: { id: string; degree: string; specialization: string }[] = [];
    for (const programme of source.programmes) {
      if (college.courses.some(offering => offering.course.degree === programme.degree && offering.specialization === programme.name)) continue;
      const stream = ["MBA", "BBA"].includes(programme.degree) ? "Management" : ["MCA", "BCA"].includes(programme.degree) ? "Computer Applications" : programme.degree === "M.Sc" ? "Science" : "Engineering";
      const feeGroup = source.historicalFees.find(group => programme.degree === "B.Tech" ? group.programme.startsWith("B.TECH") && (/Civil|Mechanical|Electrical/.test(programme.name) ? group.programme.includes("CIVIL") : group.programme.includes("CSE")) : programme.degree === "M.Tech" ? group.programme === "M.TECH" : programme.degree === "M.Sc" ? group.programme === "M.Sc." : ["BBA", "BCA"].includes(programme.degree) ? group.programme === "BBA & BCA" : group.programme === programme.degree);
      const data = parseDataMutation("offerings", "create", { courseName: programme.name, degree: programme.degree, stream, level: programme.level, durationYrs: null, specialization: programme.name, totalFeesInr: null, firstYearFeesInr: null, hostelFeesYearlyInr: null, publishedFeeInr: feeGroup?.items.find(item => item.category === "tuition")?.amount ?? null, feeAcademicYear: feeGroup?.academicYear || null, feeBasis: feeGroup ? "Historical published tuition amount. The document does not specify whether this is per semester, per year, or total. Confirm current fees with the college." : null, feeSourceUrl: feeGroup ? "https://www.thenalanda.com/api/fees-structure/" : null, eligibilityDescription: "Programme-specific eligibility and current intake requirements have not been verified. Confirm with the admissions office.", acceptedExamSlugs: [], programOverviewHtml: `<p>${programme.name} is included in the official department programme list for ${college.name}, checked ${source.verifiedAt}.</p><p>Confirm current intake and programme details with the institution. <a href="https://www.thenalanda.com/departments">Official department directory</a>.</p>` });
      const row = await applyDataMutation(tx, { resource: "offerings", operation: "create", collegeId: college.id, data }, admin.id);
      created.push({ id: row.id, degree: programme.degree, specialization: programme.name });
    }
    return { collegeId: college.id, slug: college.slug, sourceVerifiedAt: source.verifiedAt, sourceUrls: source.sources, created, preservedExistingCollege: true, currentFeesAndPlacementsNotInferred: true };
  }, { timeout: 30000 });
  await mkdir("audit/2026-11-19", { recursive: true });
  await writeFile("audit/2026-11-19/nalanda-programmes.json", JSON.stringify(report, null, 2) + "\n");
  console.log(`Added ${report.created.length} documented programmes to the existing Nalanda record. Current fees, duration, eligibility and placements remain unverified.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
