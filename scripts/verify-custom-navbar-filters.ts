import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { getCustomNavbarFilters, saveCustomNavbarFilter, validateCustomNavbarFilter } from "../src/lib/custom-navbar-filters";
import { CollegeCreateSchema, CollegeUpdateSchema } from "../src/lib/college-validation";
import { NAVBAR_FILTERS } from "../src/lib/navbar-filters";
const db = new PrismaClient();
const marker = `qa-section-${randomUUID()}`;
async function main() {
  try {
    await db.$transaction(async tx => {
      const input = { label: marker, category: "engineering", section: "column_1" };
      const filter = await saveCustomNavbarFilter(tx, input);
      const same = await saveCustomNavbarFilter(tx, { ...input, label: ` ${marker.toUpperCase()} `, section: "column_3" });
      assert.equal(filter.id, same.id, "Reuse case-insensitive matching sections rather than duplicates");
      assert.equal(await tx.navbarFilter.count({ where: { label: marker } }), 1);
      assert.match(filter.href, /^\/colleges\/sections\/engineering-/);
      const existing = NAVBAR_FILTERS.find(row => row.category === "engineering")!;
      assert.equal((await saveCustomNavbarFilter(tx, { ...input, label: existing.label })).id, existing.id);
      const parsed = CollegeCreateSchema.parse({ name: marker, slug: marker, city: "Bhubaneswar", state: "Odisha", showInNavbar: true, navbarCategory: "engineering", navbarFilter: filter.id });
      assert.equal(parsed.navbarSection, "column_1");
      assert.equal(CollegeUpdateSchema.parse({ navbarFilter: filter.id }).navbarCategory, "engineering");
      await validateCustomNavbarFilter(tx, parsed);
      await assert.rejects(validateCustomNavbarFilter(tx, { navbarFilter: `custom:engineering:column_1:missing-${marker}` }));
      const { onboardingData, ...profile } = parsed;
      const college = await tx.college.create({ data: { ...profile, isPublished: false } });
      assert.equal((await getCustomNavbarFilters(true, tx)).some(row => row.id === filter.id), false, "Unpublished assignments must not expose sections");
      await tx.college.update({ where: { id: college.id }, data: { isPublished: true } });
      assert.equal((await getCustomNavbarFilters(true, tx)).some(row => row.id === filter.id), true);
      await tx.college.update({ where: { id: college.id }, data: { showInNavbar: false } });
      assert.equal((await getCustomNavbarFilters(true, tx)).some(row => row.id === filter.id), false);
      throw Error("VERIFY_ROLLBACK");
    }, { timeout: 30000 });
  } catch (error) { if (!(error instanceof Error) || error.message !== "VERIFY_ROLLBACK") throw error; }
  assert.equal(await db.navbarFilter.count({ where: { label: marker } }), 0);
  console.log("Custom navbar sections passed: save/reuse, built-in matching, profile validation, clean URLs, publication visibility, and complete rollback.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
