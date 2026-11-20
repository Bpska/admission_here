import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { writeFile } from "node:fs/promises";
import {
  collegeTemplate,
  parseSpreadsheet,
} from "../src/lib/college-import/spreadsheet";
async function main() {
  const generated = await collegeTemplate();
  const original = await parseSpreadsheet(generated, "template.xlsx");
  assert.equal(original.rows.length, 1);
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Colleges");
  sheet.addRow([
    "College Name",
    "City",
    "State",
    "College Type",
    "Programmes JSON",
  ]);
  sheet.addRow([
    "Compatibility Test College",
    "Test City",
    "Test State",
    "PRIVATE",
    JSON.stringify([{ degree: "MCA", specialization: "General" }]),
  ]);
  const bytes = Buffer.from(await book.xlsx.writeBuffer());
  const expected = await parseSpreadsheet(bytes, "standard.xlsx");
  async function prefixed(source: Buffer) {
    const zip = await JSZip.loadAsync(source);
    for (const entry of Object.values(zip.files)) {
      if (
        !/^xl\/(workbook|sharedStrings|styles|worksheets\/sheet\d+)\.xml$/.test(
          entry.name,
        )
      )
        continue;
      let xml = await entry.async("string");
      xml = xml
        .replace(/<(\/?)([A-Za-z][\w.-]*)(?=[\s/>])/g, "<$1ns0:$2")
        .replace(
          'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
          'xmlns:ns0="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
        )
        .replaceAll("xmlns:r=", "xmlns:rel=")
        .replaceAll(" r:id=", " rel:id=");
      zip.file(entry.name, xml);
    }
    return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  }
  const compatible = await prefixed(bytes);
  assert.deepEqual(
    await parseSpreadsheet(compatible, "namespaced.xlsx"),
    expected,
  );
  console.log(
    "PASS Standard and namespace-prefixed workbooks produce identical college rows",
  );
  const templateCompat = await prefixed(generated);
  assert.deepEqual(
    await parseSpreadsheet(templateCompat, "namespaced-template.xlsx"),
    original,
  );
  console.log(
    "PASS Download template, including styles and comments, survives namespace compatibility normalization",
  );
  const renamed = await JSZip.loadAsync(bytes);
  renamed.file(
    "xl/worksheets/college-data.xml",
    await renamed.file("xl/worksheets/sheet1.xml")!.async("nodebuffer"),
  );
  renamed.remove("xl/worksheets/sheet1.xml");
  const relationships = await renamed
    .file("xl/_rels/workbook.xml.rels")!
    .async("string");
  renamed.file(
    "xl/_rels/workbook.xml.rels",
    relationships.replaceAll(
      "worksheets/sheet1.xml",
      "worksheets/college-data.xml",
    ),
  );
  assert.deepEqual(
    await parseSpreadsheet(
      await renamed.generateAsync({ type: "nodebuffer" }),
      "custom-sheet-path.xlsx",
    ),
    expected,
  );
  console.log(
    "PASS Valid worksheets with custom internal filenames import correctly",
  );
  const utf16 = await JSZip.loadAsync(bytes);
  for (const entry of Object.values(utf16.files)) {
    if (!/\.(xml|rels)$/.test(entry.name)) continue;
    const xml = await entry.async("string");
    utf16.file(
      entry.name,
      Buffer.concat([
        Buffer.from([0xff, 0xfe]),
        Buffer.from(
          xml.replace('encoding="UTF-8"', 'encoding="UTF-16"'),
          "utf16le",
        ),
      ]),
    );
  }
  assert.deepEqual(
    await parseSpreadsheet(
      await utf16.generateAsync({ type: "nodebuffer" }),
      "utf16.xlsx",
    ),
    expected,
  );
  console.log("PASS UTF-16 workbook XML preserves all cell values");
  const hundred = new ExcelJS.Workbook();
  const hundredSheet = hundred.addWorksheet("Colleges");
  hundredSheet.addRow(["College Name", "City", "State"]);
  for (let i = 0; i < 100; i++)
    hundredSheet.addRow([`Parser Test ${i}`, "Test City", "Test State"]);
  assert.equal(
    (
      await parseSpreadsheet(
        Buffer.from(await hundred.xlsx.writeBuffer()),
        "hundred.xlsx",
      )
    ).rows.length,
    100,
  );
  console.log("PASS 100-college XLSX retains one record per row");
  const dateBook = new ExcelJS.Workbook();
  dateBook.addWorksheet("Colleges").addRows([
    ["College Name", "Established Year"],
    ["Test College", new Date("2020-01-01T00:00:00Z")],
  ]);
  await assert.rejects(
    () =>
      dateBook.xlsx
        .writeBuffer()
        .then((buffer) => parseSpreadsheet(Buffer.from(buffer), "date.xlsx")),
    /use text for dates/,
  );
  console.log(
    "PASS Date-styled cells are rejected instead of importing serial numbers",
  );
  sheet.getCell("A2").value = { formula: "1+1" };
  await assert.rejects(() => prefixed(Buffer.from([])));
  await assert.rejects(
    async () =>
      parseSpreadsheet(
        await prefixed(Buffer.from(await book.xlsx.writeBuffer())),
        "formula.xlsx",
      ),
    /formulas/,
  );
  console.log("PASS Namespace compatibility does not bypass formula rejection");
  const damaged = await JSZip.loadAsync(compatible);
  damaged.file("xl/workbook.xml", "<not-a-workbook/>");
  await assert.rejects(
    async () =>
      parseSpreadsheet(
        await damaged.generateAsync({ type: "nodebuffer" }),
        "broken.xlsx",
      ),
    /valid Excel workbook/,
  );
  console.log("PASS Invalid workbook structures are still rejected safely");
  if (process.env.XLSX_COMPAT_FIXTURE)
    await writeFile(process.env.XLSX_COMPAT_FIXTURE, compatible);
  console.log("8 XLSX compatibility checks passed. No database writes.");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
