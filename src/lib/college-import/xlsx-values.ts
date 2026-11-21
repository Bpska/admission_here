import JSZip from "jszip";
import { SaxesParser, SaxesTagNS } from "saxes";
import { posix } from "node:path";
import { LIMITS } from "./fields";

const MAIN = new Set([
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  "http://purl.oclc.org/ooxml/spreadsheetml/main",
]);
const REL = new Set([
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  "http://purl.oclc.org/ooxml/officeDocument/relationships",
]);
type Part = { id: string; type: string; target: string; external: boolean };
function attr(tag: SaxesTagNS, name: string) {
  return (
    Object.values(tag.attributes).find((a) => a.local === name)?.value || ""
  );
}
function decode(bytes: Buffer) {
  const le =
    (bytes[0] === 0xff && bytes[1] === 0xfe) ||
    (bytes[0] === 0x3c && bytes[1] === 0);
  const be =
    (bytes[0] === 0xfe && bytes[1] === 0xff) ||
    (bytes[0] === 0 && bytes[1] === 0x3c);
  return new TextDecoder(le ? "utf-16le" : be ? "utf-16be" : "utf-8", {
    fatal: true,
  }).decode(bytes);
}
async function xml(
  zip: JSZip,
  path: string,
  setup: (parser: SaxesParser<{ xmlns: true }>) => void,
) {
  const file = zip.file(path);
  if (!file)
    throw new Error(
      `The Excel file is missing ${path}. Download a fresh template and copy your rows into it.`,
    );
  const parser = new SaxesParser({ xmlns: true });
  setup(parser);
  parser.on("doctype", () => {
    throw new Error(
      "Excel files containing XML document type declarations are not supported.",
    );
  });
  try {
    parser.write(decode(await file.async("nodebuffer"))).close();
  } catch (error) {
    throw new Error(
      `Cannot read Excel part ${path}: ${error instanceof Error ? error.message : "invalid XML"}`,
    );
  }
}
function target(base: string, value: string) {
  if (!value || /[\\?#]/.test(value) || /^[a-z][a-z0-9+.-]*:/i.test(value))
    throw new Error(
      "The workbook contains an invalid internal file reference.",
    );
  const path = posix.normalize(
    value.startsWith("/")
      ? value.slice(1)
      : posix.join(posix.dirname(base), value),
  );
  if (path === ".." || path.startsWith("../"))
    throw new Error("The workbook contains an unsafe file reference.");
  return path;
}
async function relations(zip: JSZip, part: string) {
  const path = part
    ? posix.join(posix.dirname(part), "_rels", posix.basename(part) + ".rels")
    : "_rels/.rels";
  const result: Part[] = [];
  if (!zip.file(path)) return result;
  await xml(zip, path, (parser) =>
    parser.on("opentag", (tag) => {
      if (tag.local === "Relationship")
        result.push({
          id: attr(tag, "Id"),
          type: attr(tag, "Type"),
          target: attr(tag, "Target"),
          external: attr(tag, "TargetMode").toLowerCase() === "external",
        });
    }),
  );
  return result;
}
function internal(parts: Part[], type: string) {
  const found = parts.filter((p) => p.type.endsWith("/" + type));
  if (found.length > 1)
    throw new Error(`The workbook has ambiguous ${type} references.`);
  if (found[0]?.external)
    throw new Error("External workbook references are not supported.");
  return found[0];
}
async function strings(zip: JSZip, path: string | undefined) {
  const result: string[] = [];
  if (!path) return result;
  let active = false,
    text = "",
    phonetic = 0,
    capture = false;
  await xml(zip, path, (parser) => {
    parser.on("opentag", (tag) => {
      if (!MAIN.has(tag.uri)) return;
      if (tag.local === "si") {
        active = true;
        text = "";
      }
      if (tag.local === "rPh") phonetic++;
      if (tag.local === "t" && active && !phonetic) capture = true;
    });
    const receiveText = (value: string) => {
      if (capture) {
        text += value;
        if (text.length > LIMITS.cell)
          throw new Error("A cell exceeds 100,000 characters.");
      }
    };
    parser.on("text", receiveText);
    parser.on("cdata", receiveText);
    parser.on("closetag", (tag) => {
      if (!MAIN.has(tag.uri)) return;
      if (tag.local === "t") capture = false;
      if (tag.local === "rPh") phonetic--;
      if (tag.local === "si") {
        result.push(text);
        active = false;
      }
    });
  });
  return result;
}
async function dateStyles(zip: JSZip, path: string | undefined) {
  const formats = new Map<number, string>(),
    dates = new Set<number>();
  if (!path) return dates;
  let inXfs = false,
    index = 0;
  await xml(zip, path, (parser) => {
    parser.on("opentag", (tag) => {
      if (!MAIN.has(tag.uri)) return;
      if (tag.local === "numFmt")
        formats.set(Number(attr(tag, "numFmtId")), attr(tag, "formatCode"));
      if (tag.local === "cellXfs") inXfs = true;
      else if (tag.local === "xf" && inXfs) {
        const id = Number(attr(tag, "numFmtId"));
        const code = (formats.get(id) || "").replace(
          /"[^"]*"|\\.|\[(?!h+\]|m+\]|s+\])[^\]]*\]/gi,
          "",
        );
        if (
          (id >= 14 && id <= 22) ||
          (id >= 27 && id <= 36) ||
          (id >= 45 && id <= 47) ||
          (id >= 50 && id <= 58) ||
          /[ymdhs]/i.test(code)
        )
          dates.add(index);
        index++;
      }
    });
    parser.on("closetag", (tag) => {
      if (tag.local === "cellXfs") inXfs = false;
    });
  });
  return dates;
}
/** Values-only OOXML reader. Resolves actual relationships and namespace URIs,
 * without depending on workbook layout, tab IDs, style rendering or ExcelJS transforms.
 * The caller must run ZIP limits/macro checks before invoking this reader.
 */
export async function readXlsxValues(bytes: Buffer): Promise<string[][]> {
  const zip = await JSZip.loadAsync(bytes);
  const root = internal(await relations(zip, ""), "officeDocument");
  const workbook = root ? target("", root.target) : "xl/workbook.xml";
  const sheets: { name: string; id: string }[] = [];
  let validRoot = false;
  await xml(zip, workbook, (parser) =>
    parser.on("opentag", (tag) => {
      if (tag.local === "workbook" && MAIN.has(tag.uri)) validRoot = true;
      if (tag.local === "sheet" && MAIN.has(tag.uri))
        sheets.push({
          name: attr(tag, "name"),
          id:
            Object.values(tag.attributes).find(
              (a) => a.local === "id" && REL.has(a.uri),
            )?.value || "",
        });
    }),
  );
  if (!validRoot)
    throw new Error(
      "This file does not contain a valid Excel workbook. Use the downloaded .xlsx template or UTF-8 CSV.",
    );
  if (sheets.length !== 1)
    throw new Error("Use exactly one worksheet, with one college per row.");
  const parts = await relations(zip, workbook);
  const sheetPart = parts.find(
    (p) => p.id === sheets[0].id && p.type.endsWith("/worksheet"),
  );
  if (!sheetPart || sheetPart.external)
    throw new Error(
      "The workbook worksheet reference is missing or external. Copy your rows into the downloadable template.",
    );
  const sst = internal(parts, "sharedStrings"),
    styles = internal(parts, "styles");
  const shared = await strings(
    zip,
    sst ? target(workbook, sst.target) : undefined,
  );
  const dates = await dateStyles(
    zip,
    styles ? target(workbook, styles.target) : undefined,
  );
  const grid: string[][] = [];
  let row = 0,
    col = 0,
    maxCol = 0,
    previousRow = 0,
    inData = false,
    cell: {
      col: number;
      type: string;
      style: number;
      value: string;
      inline: string;
    } | null = null,
    capture: "value" | "inline" | null = null,
    phonetic = 0;
  const seen = new Set<number>();
  await xml(zip, target(workbook, sheetPart.target), (parser) => {
    parser.on("opentag", (tag) => {
      if (!MAIN.has(tag.uri)) return;
      if (tag.local === "mergeCell")
        throw new Error("Remove merged cells before uploading.");
      if (tag.local === "sheetData") {
        inData = true;
        return;
      }
      if (!inData) return;
      if (tag.local === "row") {
        row = attr(tag, "r") ? Number(attr(tag, "r")) : previousRow + 1;
        if (!Number.isSafeInteger(row) || row < 1 || row <= previousRow)
          throw new Error("Worksheet row numbers are invalid or repeated.");
        previousRow = row;
        col = 0;
        seen.clear();
      }
      if (tag.local === "c") {
        const ref = attr(tag, "r");
        let next = col + 1;
        if (ref) {
          const match = /^([A-Z]+)([1-9]\d*)$/i.exec(ref);
          if (!match || Number(match[2]) !== row)
            throw new Error(`Row ${row}: invalid cell reference.`);
          next = 0;
          for (const char of match[1].toUpperCase())
            next = next * 26 + char.charCodeAt(0) - 64;
        }
        if (!row || seen.has(next))
          throw new Error("Worksheet cells are outside a row or repeated.");
        seen.add(next);
        col = next;
        cell = {
          col: next,
          type: attr(tag, "t"),
          style: Number(attr(tag, "s") || 0),
          value: "",
          inline: "",
        };
      }
      if (!cell) return;
      if (tag.local === "f")
        throw new Error(
          `Row ${row}: formulas are not supported. Paste values instead.`,
        );
      if (tag.local === "rPh") phonetic++;
      if (tag.local === "v") capture = "value";
      if (tag.local === "t" && !phonetic) capture = "inline";
    });
    const receiveText = (text: string) => {
      if (!cell || !capture) return;
      if (capture === "value") cell.value += text;
      else cell.inline += text;
      if (cell.value.length + cell.inline.length > LIMITS.cell)
        throw new Error("A cell exceeds 100,000 characters.");
    };
    parser.on("text", receiveText);
    parser.on("cdata", receiveText);
    parser.on("closetag", (tag) => {
      if (!MAIN.has(tag.uri)) return;
      if (tag.local === "sheetData") inData = false;
      if (tag.local === "v" || tag.local === "t") capture = null;
      if (tag.local === "rPh") phonetic--;
      if (tag.local !== "c" || !cell) return;
      if (cell.type === "e")
        throw new Error(
          `Row ${row}: error cells are not supported. Paste valid values instead.`,
        );
      if (
        cell.type === "d" ||
        (cell.value &&
          (!cell.type || cell.type === "n") &&
          dates.has(cell.style))
      )
        throw new Error(
          `Row ${row}: use text for dates and a number for years.`,
        );
      let value = cell.type === "inlineStr" ? cell.inline : cell.value;
      if (cell.type === "s") {
        if (!/^\d+$/.test(cell.value) || Number(cell.value) >= shared.length)
          throw new Error(`Row ${row}: a shared text reference is missing.`);
        value = shared[Number(cell.value)];
      }
      if (cell.type === "b") value = cell.value === "1" ? "true" : "false";
      if (value !== "") {
        if (row > LIMITS.rows + 1 || cell.col > LIMITS.columns)
          throw new Error("Maximum 500 college rows and 80 columns.");
        grid[row - 1] ??= [];
        grid[row - 1][cell.col - 1] = value;
        maxCol = Math.max(maxCol, cell.col);
      }
      cell = null;
    });
  });
  return Array.from({ length: grid.length }, (_, i) =>
    Array.from({ length: maxCol }, (_, j) => grid[i]?.[j] || ""),
  );
}
