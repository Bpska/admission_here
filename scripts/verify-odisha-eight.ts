import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import source from "../src/data/college-imports/odisha-eight.json";
import { programKey } from "../src/lib/college-programs";
const db = new PrismaClient();
async function main() {
  const rows = await db.college.findMany({ where: { slug: { in: source.colleges.map(college => college.slug) } }, include: { courses: { include: { course: true } }, placements: true, rankings: true } });
  assert.equal(rows.length, 8); assert.equal(rows.filter(college => college.isPublished).length, 8);
  assert.equal(rows.reduce((sum, college) => sum + college.courses.length, 0), 179);
  let pages = 0, images = 0;
  const base = "http://localhost:3000";
  for (const input of source.colleges) {
    const college = rows.find(college => college.slug === input.slug)!;
    assert.equal(college.websiteUrl, input.websiteUrl); assert.equal(college.courses.length, input.offerings.length); assert.equal(college.placements.length, 0);
    assert.ok(college.courses.every(offering => offering.totalFeesInr === null && offering.firstYearFeesInr === null));
    assert.equal(college.ratingOverall, 0); assert.equal(college.reviewCount, 0);
    assert.equal(await db.college.count({ where: { slug: input.slug } }), 1);
    for (const tab of ["", "/courses-fees", "/admission", "/cutoff", "/placements", "/rankings", "/gallery", "/reviews", "/qna", "/blogs"]) {
      const path = `/college/${college.slug}${tab}`; const response = await fetch(base + path); const html = await response.text(); assert.equal(response.status, 200, path); assert.ok(!html.includes("PrismaClientValidationError"), path); pages++;
      if (!tab) { assert.ok(!html.includes("Central Library with 1,00,000+")); assert.ok(!html.includes("AICTE, UGC, MHRD")); }
    }
    const key = programKey(college.courses[0].course.degree);
    const path = `/college/${college.slug}/programs/${key}`; const response = await fetch(base + path); assert.equal(response.status, 200, path); assert.ok((await response.text()).includes(`${path}/admission`)); pages++;
    for (const url of [college.logoUrl, college.coverImageUrl].filter((url): url is string => !!url)) {
      const response = await fetch(base + url); assert.equal(response.status, 200, url); assert.ok(response.headers.get("content-type")?.startsWith("image/")); assert.ok((await response.arrayBuffer()).byteLength <= 3 * 1024 * 1024); images++;
    }
    console.log(`${college.shortName}: ${college.courses.length} programmes, 11 pages checked.`);
  }
  const engineering = await (await fetch(base + "/colleges?stream=Engineering")).text();
  for (const college of rows) assert.ok(engineering.includes(`/college/${college.slug}/programs/`), `Engineering filter includes ${college.name}`);
  const mca = await (await fetch(base + "/colleges/mca")).text();
  for (const college of rows.filter(college => college.courses.some(offering => programKey(offering.course.degree) === "mca"))) assert.ok(mca.includes(`/college/${college.slug}/programs/mca`));
  const gita = rows.find(college => college.slug === "gita-autonomous-college-bhubaneswar")!;
  assert.notEqual(gita.id, (await db.college.findUniqueOrThrow({ where: { slug: "gandhi-institute-for-technology-gift-autonomous-bhubaneswar" } })).id);
  console.log(`Eight-college import passed: ${pages} profile/programme pages, ${images} image checks, accurate counts, no duplicate colleges, course filters, and no fabricated current fees or placement statistics.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
