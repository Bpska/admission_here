const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { prepareBlogAnalytics } = require("./prepare-blog-analytics.cjs");
require("@next/env").loadEnvConfig(process.cwd());

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
    "Run this verification only against a local database.",
  );
  const schema = `qa_blog_analytics_${randomUUID().replaceAll("-", "")}`;
  const base = new PrismaClient();
  url.searchParams.set("schema", schema);
  const db = new PrismaClient({ datasourceUrl: url.href });
  try {
    await base.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await base.$executeRawUnsafe(
      `CREATE TABLE "${schema}"."BlogPost" ("id" UUID PRIMARY KEY)`,
    );
    const setups = await Promise.all([
      prepareBlogAnalytics(db),
      prepareBlogAnalytics(db),
    ]);
    assert.deepEqual(
      setups.map((list) => list.length).sort(),
      [0, 4],
      "Concurrent containers prepare missing tables once.",
    );
    const blogId = randomUUID(),
      visitId = randomUUID(),
      visitor = "a".repeat(64);
    await db.$executeRaw`INSERT INTO "BlogPost" ("id") VALUES (${blogId}::uuid)`;
    await db.$executeRaw`INSERT INTO "BlogVisit" ("blogId", "visitorHash", "viewCount") VALUES (${blogId}::uuid, ${visitor}, 7)`;
    await db.$executeRaw`INSERT INTO "BlogQualifiedView" ("id", "blogId", "visitorHash") VALUES (${visitId}::uuid, ${blogId}::uuid, ${visitor})`;
    assert.deepEqual(await prepareBlogAnalytics(db), []);
    assert.equal(
      (await db.blogVisit.findFirstOrThrow()).viewCount,
      7,
      "Restart preserves historical views.",
    );
    assert.equal(
      await db.blogQualifiedView.count(),
      1,
      "Restart preserves duplicate protection.",
    );
    // Reproduce an older deployment with visitor aggregates but no qualified-event table.
    await db.$executeRaw`DROP TABLE "BlogQualifiedView"`;
    assert.deepEqual(await prepareBlogAnalytics(db), [
      "013_qualified_blog_views",
    ]);
    assert.equal((await db.blogVisit.findFirstOrThrow()).viewCount, 7);
    await db.$executeRaw`CREATE TABLE "User" ("id" UUID PRIMARY KEY, "name" TEXT NOT NULL)`;
    await db.$executeRaw`INSERT INTO "User" ("id", "name") VALUES (${randomUUID()}::uuid, 'Existing staff')`;
    assert.deepEqual(await prepareBlogAnalytics(db), ["016_staff_designation"]);
    const [profile] = await db.$queryRaw`SELECT "name", "designation" FROM "User"`;
    assert.equal(profile.name, "Existing staff");
    assert.equal(profile.designation, null);
    await db.$executeRaw`UPDATE "User" SET "designation" = 'Admissions Counsellor'`;
    assert.deepEqual(await prepareBlogAnalytics(db), []);
    const [saved] = await db.$queryRaw`SELECT "designation" FROM "User"`;
    assert.equal(saved.designation, "Admissions Counsellor", "Startup preserves saved designations");
    await db.$executeRaw`DROP TABLE "CollegeImportRow"`;
    assert.deepEqual(await prepareBlogAnalytics(db), ["015_college_imports"]);
    assert.equal(await db.collegeImportRow.count(), 0);
    assert.equal((await db.blogVisit.findFirstOrThrow()).viewCount, 7);
    console.log(
      "Blog analytics startup passed: missing tables, concurrent containers, existing data preserved, and older deployments with a missing qualified-view table.",
    );
  } finally {
    await db.$disconnect();
    await base.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await base.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
