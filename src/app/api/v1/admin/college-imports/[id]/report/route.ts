import { z } from "zod";
import {
  importAccess,
  importError,
  privateHeaders,
} from "@/lib/college-import/http";
import { getImport } from "@/lib/college-import/service";
import { safeCsv } from "@/lib/college-import/spreadsheet";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await importAccess();
  if (error) return error;
  try {
    const { id } = await params;
    z.string().uuid().parse(id);
    const job = await getImport(id);
    const csv = safeCsv([
      [
        "Row",
        "College",
        "Decision",
        "Status",
        "College ID (result)",
        "Errors",
        "Warnings",
      ],
      ...job.rows.map((row) => {
        const p = row.preview as any;
        return [
          row.rowNumber,
          p.name,
          p.choice.action,
          row.status,
          row.collegeId,
          [...(p.errors || []), row.status === "FAILED" ? row.message : ""]
            .filter(Boolean)
            .join("; "),
          (p.warnings || []).join("; "),
        ];
      }),
    ]);
    return new Response(csv, {
      headers: {
        ...privateHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="college-import-${id}-results.csv"`,
      },
    });
  } catch (e) {
    return importError(e);
  }
}
