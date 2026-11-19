import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PrismaClient } from "@prisma/client";
import { applyDataMutation, DATA_SCHEMAS } from "../src/lib/admin-data";
import { CollegePlacementsContent } from "../src/components/college/CollegePlacementsContent";
const db = new PrismaClient();
const marker = `qa-placement-${randomUUID()}`;
async function main() {
  try {
    await db.$transaction(async tx => {
      const college = await tx.college.create({ data: { name: marker, slug: marker, city: "Bhubaneswar", state: "Odisha", ownershipType: "PRIVATE", overviewHtml: "Verification", isPublished: false } });
      const photoUrls: string[] = [];
      for (let index = 0; index < 2; index++) {
        const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jKZkAAAAASUVORK5CYII=', 'base64');
        const image = await tx.blogImage.create({ data: { data: bytes, size: bytes.length, mimeType: "image/png" } });
        photoUrls.push(`/api/v1/blog-images/${image.id}`);
      }
      const data = { batchYear: 2026, highestPackageInr: 1200000, averagePackageInr: 600000, medianPackageInr: 500000, placementPercentage: 80, totalOffers: 40, topRecruiters: ["Verified company"], photoUrls };
      assert.equal(DATA_SCHEMAS.placements.safeParse({ ...data, photoUrls: ["https://example.com/private.jpg"] }).success, false);
      const placement = await applyDataMutation(tx, { resource: "placements", operation: "create", collegeId: college.id, data }, randomUUID());
      const saved = await tx.college.findUniqueOrThrow({ where: { id: college.id }, include: { placements: true } });
      assert.deepEqual(saved.placements[0].photoUrls, photoUrls);
      const html = renderToStaticMarkup(<CollegePlacementsContent college={saved} />);
      assert.ok(html.includes("Placement photos"));
      for (const url of photoUrls) assert.ok(html.includes(url));
      await applyDataMutation(tx, { resource: "placements", operation: "update", collegeId: college.id, id: placement.id, data: { photoUrls: [photoUrls[1]] } }, randomUUID());
      const updated = await tx.placementStat.findUniqueOrThrow({ where: { id: placement.id } });
      assert.deepEqual(updated.photoUrls, [photoUrls[1]]); assert.equal(Number(updated.highestPackageInr), 1200000);
      throw Error("VERIFY_ROLLBACK");
    }, { timeout: 30000 });
  } catch (error) { if (!(error instanceof Error) || error.message !== "VERIFY_ROLLBACK") throw error; }
  assert.equal(await db.college.count({ where: { slug: marker } }), 0);
  console.log("Placement photos passed: multiple stored uploads, reload, public rendering, removal without changing statistics, and complete rollback.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
