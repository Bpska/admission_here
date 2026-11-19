import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { programKey, programChoices, collegeProgramHref } from "../src/lib/college-programs";
import { applyDataMutation, parseDataMutation } from "../src/lib/admin-data";
const db = new PrismaClient();
async function main() {
  assert.equal(programKey("M.C.A."), "mca"); assert.equal(programKey("B.Tech"), "b-tech");
  assert.equal(collegeProgramHref("nalanda", "mca", "admission"), "/college/nalanda/programs/mca/admission");
  assert.equal(programChoices([{ course: { degree: "MCA", fullName: "MCA", stream: "Computer Applications" } }, { course: { degree: "M.C.A.", fullName: "MCA", stream: "Computer Applications" } }]).length, 1);
  try { await db.$transaction(async tx => {
    const marker = `qa-program-${randomUUID()}`;
    const admin = await tx.user.create({ data: { name: marker, email: `${marker}@example.com`, role: "SUPER_ADMIN" } });
    const college = await tx.college.create({ data: { name: marker, slug: marker, city: "Bhubaneswar", state: "Odisha", ownershipType: "PRIVATE", overviewHtml: "Shared campus" } });
    const make = (degree: string, stream: string, fee: number) => applyDataMutation(tx, { resource: "offerings", operation: "create", collegeId: college.id, data: parseDataMutation("offerings", "create", { courseName: `${degree} course`, degree, stream, level: "PG", specialization: degree, totalFeesInr: fee, acceptedExamSlugs: [], programOverviewHtml: `<p>${degree} overview</p>`, programAdmissionHtml: `<p>${degree} admission</p>`, programPlacementHtml: `<p>${degree} placements</p>` }) }, admin.id);
    const mca = await make("MCA", "Computer Applications", 140000);
    const mba = await make("MBA", "Management", 250000);
    await applyDataMutation(tx, { resource: "offerings", operation: "update", collegeId: college.id, id: mca.id, data: parseDataMutation("offerings", "update", { programAdmissionHtml: "<p>Updated MCA admission</p>" }) }, admin.id);
    const savedMca = await tx.collegeCourse.findUniqueOrThrow({ where: { id: mca.id } });
    const savedMba = await tx.collegeCourse.findUniqueOrThrow({ where: { id: mba.id } });
    assert.equal(savedMca.programAdmissionHtml, "<p>Updated MCA admission</p>"); assert.equal(savedMca.totalFeesInr, 140000);
    assert.equal(savedMba.programAdmissionHtml, "<p>MBA admission</p>"); assert.equal(savedMba.totalFeesInr, 250000);
    assert.equal((await tx.college.findUniqueOrThrow({ where: { id: college.id } })).overviewHtml, "Shared campus");
    throw Error("VERIFY_ROLLBACK");
  }, { timeout: 30000 }); } catch (error) { if (!(error instanceof Error) || error.message !== "VERIFY_ROLLBACK") throw error; }
  const slug = "nalanda-institute-of-technology-bhubaneswar";
  const college = await db.college.findUniqueOrThrow({ where: { slug }, include: { courses: { include: { course: true } } } });
  assert.ok(college.courses.some(offering => programKey(offering.course.degree) === "mca"));
  assert.equal(await db.college.count({ where: { slug } }), 1);
  for (const key of ["mca", "mba", "b-tech"]) {
    const url = collegeProgramHref(slug, key); const response = await fetch(`http://localhost:3000${url}`); const html = await response.text();
    assert.equal(response.status, 200); assert.ok(html.includes(`${url}/admission`));
    const table = html.match(/<table[\s\S]*?<\/table>/)?.[0] || "";
    assert.ok(table.includes(key === "b-tech" ? "B.Tech" : key.toUpperCase()));
    if (key === "mca") { assert.ok(!table.includes("Civil Engineering")); assert.ok(!table.includes("Marketing")); }
  }
  const directory = await (await fetch("http://localhost:3000/colleges/mca")).text(); assert.ok(directory.includes(collegeProgramHref(slug, "mca")));
  console.log("College programme checks passed: normalized degree routes, per-course content persistence, isolated updates, same college identity, filtered fee tables, contextual tabs and MCA directory links.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
