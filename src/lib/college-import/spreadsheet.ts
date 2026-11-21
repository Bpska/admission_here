import ExcelJS from "exceljs";
import { readXlsxValues } from "./xlsx-values";
import { inflateRawSync } from "node:zlib";
import { IMPORT_FIELDS, LIMITS, PROGRAMME_SAMPLE, autoMapping } from "./fields";

function inspectArchive(bytes: Buffer) {
  // Check ZIP metadata before inflating XML. Reject encrypted/macro and oversized archives.
  const start = Math.max(0, bytes.length - 65557);
  let end = -1;
  for (let i = bytes.length - 22; i >= start; i--)
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0)
    throw new Error("The XLSX archive is damaged. Save it again as .xlsx.");
  const count = bytes.readUInt16LE(end + 10),
    offset = bytes.readUInt32LE(end + 16);
  if (count > 1000 || count === 65535 || offset >= bytes.length)
    throw new Error(
      "This workbook has too many parts or uses unsupported ZIP64 compression.",
    );
  let pos = offset,
    expanded = 0;
  for (let i = 0; i < count; i++) {
    if (pos + 46 > bytes.length || bytes.readUInt32LE(pos) !== 0x02014b50)
      throw new Error("Invalid XLSX archive directory.");
    const compression = bytes.readUInt16LE(pos + 10),
      compressed = bytes.readUInt32LE(pos + 20),
      local = bytes.readUInt32LE(pos + 42);
    const flags = bytes.readUInt16LE(pos + 8),
      size = bytes.readUInt32LE(pos + 24),
      n = bytes.readUInt16LE(pos + 28),
      extra = bytes.readUInt16LE(pos + 30),
      comment = bytes.readUInt16LE(pos + 32);
    const name = bytes.subarray(pos + 46, pos + 46 + n).toString("utf8");
    expanded += size;
    if (
      flags & 1 ||
      size === 0xffffffff ||
      expanded > LIMITS.expanded ||
      /vbaProject|externalLinks|\.\./i.test(name)
    )
      throw new Error(
        "Encrypted files, macros, external workbook links and expanded workbooks over 40 MB are not supported.",
      );
    if (local + 30 > bytes.length || bytes.readUInt32LE(local) !== 0x04034b50)
      throw new Error("Invalid ZIP entry.");
    const payload =
      local +
      30 +
      bytes.readUInt16LE(local + 26) +
      bytes.readUInt16LE(local + 28);
    if (payload + compressed > bytes.length)
      throw new Error("Invalid compressed size.");
    if (compression === 8) {
      const inflated = inflateRawSync(
        bytes.subarray(payload, payload + compressed),
        { maxOutputLength: Math.min(size + 1, LIMITS.expanded) },
      );
      if (inflated.length !== size)
        throw new Error("ZIP expanded size does not match its directory.");
    } else if (compression !== 0 || compressed !== size)
      throw new Error("Unsupported ZIP compression.");
    pos += 46 + n + extra + comment;
  }
}
function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const pushCell = () => {
    if (cell.length > LIMITS.cell)
      throw new Error("A cell exceeds 100,000 characters.");
    row.push(cell);
    cell = "";
    closed = false;
    if (row.length > LIMITS.columns)
      throw new Error("Maximum 80 columns per file.");
  };
  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
    if (rows.length > LIMITS.rows + 1)
      throw new Error("Maximum 500 college rows per file.");
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === '"') {
      if (cell || closed)
        throw new Error(
          "Invalid CSV quoting. Export UTF-8 comma-separated CSV.",
        );
      quoted = true;
    } else if (c === ",") pushCell();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else {
      if (closed && !/\s/.test(c))
        throw new Error("Unexpected content after a quoted CSV field.");
      if (!closed) cell += c;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted cell.");
  if (cell || row.length || closed) pushRow();
  return rows;
}
export async function parseSpreadsheet(bytes: Buffer, fileName: string) {
  if (!bytes.length || bytes.length > LIMITS.bytes)
    throw new Error("Upload a file of at most 10 MB.");
  let grid: string[][];
  if (/\.csv$/i.test(fileName)) {
    const text = new TextDecoder("utf-8", { fatal: true })
      .decode(bytes)
      .replace(/^\uFEFF/, "");
    if (text.includes("\0")) throw new Error("CSV must be UTF-8 text.");
    grid = csvRows(text);
  } else if (/\.xlsx$/i.test(fileName)) {
    inspectArchive(bytes);
    grid = await readXlsxValues(bytes);
  } else throw new Error("Only .xlsx and UTF-8 .csv files are supported.");
  if (grid.length < 2)
    throw new Error("Include a heading row and at least one college.");
  const headers = grid[0].map((x) => x.trim());
  if (
    headers.some((x) => !x) ||
    new Set(headers.map((x) => x.toLowerCase())).size !== headers.length
  )
    throw new Error("Every column needs a unique, non-empty heading.");
  for (let index = 1; index < grid.length; index++) {
    if (grid[index].slice(headers.length).some((value) => value.trim()))
      throw new Error(
        `Row ${index + 1} contains more values than headings. Quote cells containing commas or JSON in CSV files.`,
      );
  }
  const rows = grid
    .slice(1)
    .map((cells, index) => ({
      rowNumber: index + 2,
      raw: headers.map((_, i) => cells[i]?.trim() || ""),
    }))
    .filter((r) => r.raw.some(Boolean));
  if (!rows.length) throw new Error("No college rows were found.");
  return { headers, rows, mapping: autoMapping(headers) };
}
export async function collegeTemplate() {
  const book = new ExcelJS.Workbook();
  book.creator = "Admission Here";
  book.created = new Date();
  const sheet = book.addWorksheet("Colleges", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = IMPORT_FIELDS.map((f) => ({
    header: f.label,
    key: f.key,
    width: /JSON/.test(f.label)
      ? 70
      : Math.max(23, Math.min(45, f.label.length + 5)),
  }));
  sheet.getRow(1).height = 38;
  sheet.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1A3068" },
    };
    c.alignment = { vertical: "middle", wrapText: true };
  });
  const sample: any = {
    sample: "SAMPLE",
    name: "SAMPLE — Example College (do not import)",
    city: "Example City",
    state: "Example State",
    ownershipType: "PRIVATE",
    isPublished: "Draft",
    programmes: JSON.stringify(PROGRAMME_SAMPLE),
    faqsJson: JSON.stringify([
      {
        question: "What programmes are offered?",
        answer: "See the programme list.",
      },
    ]),
  };
  sheet.addRow(sample);
  sheet.getRow(2).height = 95;
  sheet.getRow(2).font = { italic: true, color: { argb: "FF64748B" } };
  sheet.getRow(2).alignment = { vertical: "top", wrapText: true };
  IMPORT_FIELDS.forEach((f, index) => {
    let hint = f.hint;
    if (f.key === "programmes")
      hint +=
        " Optional fields: totalFeesInr, publishedFeeInr, publishedCreditFeeInr, feeBasis, feeAcademicYear, feeSourceUrl, firstYearFeesInr, hostelFeesYearlyInr, intakeSeats, acceptedExamSlugs, minimumClass12Percent, eligibilityDescription, syllabusPdfUrl, programOverviewHtml, programAdmissionHtml, programPlacementHtml. Use a unique ref to link programme placements. No IDs are needed.";
    if (f.key === "cutoffs")
      hint +=
        " Default quota AI and gender Gender-Neutral. Exam must already exist. A programme ref may identify an existing programme when updating.";
    sheet.getCell(1, index + 1).note = hint;
    if (f.choices)
      for (let row = 2; row <= LIMITS.rows + 1; row++)
        sheet.getCell(row, index + 1).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: ['"' + f.choices.join(",") + '"'],
          showErrorMessage: true,
          errorStyle: "stop",
          errorTitle: "Choose a supported value",
          error: f.choices.join(", "),
        };
  });
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: LIMITS.rows + 1, column: IMPORT_FIELDS.length },
  };
  return Buffer.from(await book.xlsx.writeBuffer());
}
export function safeCsv(rows: unknown[][]) {
  // Protect exported reports from spreadsheet formula injection.
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value ?? "");
            if (/^[\s]*[=+@\-]/.test(text)) text = "'" + text;
            return '"' + text.replace(/"/g, '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}
