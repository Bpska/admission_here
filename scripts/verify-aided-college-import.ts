import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { OwnershipType } from "@prisma/client";
import { CollegeCreateSchema, CollegeUpdateSchema } from "../src/lib/college-validation";
import { autoMapping, IMPORT_FIELDS } from "../src/lib/college-import/fields";
import { collegeTemplate, parseSpreadsheet } from "../src/lib/college-import/spreadsheet";
import { validateRow } from "../src/lib/college-import/validate";
import { previewRows } from "../src/lib/college-import/service";

async function main() {
  const headers = ["College Name", "City", "State", "College Type"];
  const mapping = autoMapping(headers);
  const options = { allowUpdates: false, allowPublish: false };
  const catalog = { colleges: [], exams: [] };
  assert.equal(OwnershipType.AIDED, "AIDED");
  for (const ownership of ["AIDED", "aided", "Government Aided", "government-aided", "Govt. Aided", "Grant-in-aid"]) {
    const plan = await validateRow(["Aided Import Check", "Khordha", "Odisha", ownership], mapping, undefined, options, catalog);
    assert.deepEqual(plan.errors, [], ownership);
    assert.equal(plan.profile.ownershipType, "AIDED");
    assert.equal(plan.profile.isPublished, false);
    assert.equal(CollegeCreateSchema.parse(plan.profile).ownershipType, "AIDED");
    assert.equal(CollegeUpdateSchema.parse({ ownershipType: "AIDED" }).ownershipType, "AIDED");
  }
  console.log("PASS Aided ownership and supported aliases preserve AIDED through import/create/update validation");
  for (const ownership of ["PUBLIC_GOVERNMENT", "PRIVATE", "DEEMED", "AUTONOMOUS", "public_government"]) {
    const plan = await validateRow(["Other Import Check", "Khordha", "Odisha", ownership], mapping, undefined, options, catalog);
    assert.deepEqual(plan.errors, [], ownership);
    assert.equal(plan.profile.ownershipType, ownership.toUpperCase());
  }
  const unknown = await validateRow(["Unknown Ownership Check", "Khordha", "Odisha", "UNVERIFIED"], mapping, undefined, options, catalog);
  assert.ok(unknown.errors.some(error => error.includes("ownershipType")));
  const missing = await validateRow(["Missing City Check", "", "Odisha", "AIDED"], mapping, undefined, options, catalog);
  assert.ok(missing.errors.some(error => error.includes("city")));
  const denied = await validateRow(["Publish Check", "Khordha", "Odisha", "AIDED"], mapping, undefined, { ...options, publishOnImport: true }, catalog);
  assert.ok(denied.errors.some(error => error.includes("publishing permission")));
  console.log("PASS Other ownership types, missing required fields, unknown types and publication checks remain enforced");
  assert.ok(IMPORT_FIELDS.find(field => field.key === "ownershipType")?.choices?.includes("AIDED"));
  const template = await parseSpreadsheet(await collegeTemplate(), "template.xlsx");
  assert.equal(template.rows.length, 1);
  console.log("PASS Downloadable template includes AIDED and still parses");
  const path = process.argv[2];
  if (path) {
    if (!process.argv[3]) throw new Error("Provide both the 250-college XLSX path and the pasted error-list path.");
    const parsed = await parseSpreadsheet(await readFile(path), path);
    const source = await readFile(process.argv[3], "utf8");
    const reported = [...source.matchAll(/Row (\d+):/g)].map(match => Number(match[1]));
    assert.equal(parsed.rows.length, 250);
    const previews = await previewRows(parsed.rows, parsed.mapping, { ...options, allowPublish: true, publishOnImport: true }, catalog);
    assert.deepEqual(previews.flatMap(row => row.preview.errors.map(error => `Row ${row.rowNumber}: ${error}`)), []);
    const aided = previews.filter(row => row.preview.profile.ownershipType === "AIDED");
    assert.equal(aided.length, 237);
    assert.deepEqual(aided.map(row => row.rowNumber), reported);
    for (const row of previews) assert.equal(row.preview.profile.isPublished, true);
    const drafts = await previewRows(parsed.rows, parsed.mapping, options, catalog);
    assert.deepEqual(drafts.flatMap(row => row.preview.errors), []);
    for (const row of drafts) assert.equal(row.preview.profile.isPublished, false);
    console.log("PASS All 250 supplied XLSX rows validate in Publish and Draft modes; all 237 reported error rows are fixed");
  }
  console.log("No college data or workbook files were modified.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
