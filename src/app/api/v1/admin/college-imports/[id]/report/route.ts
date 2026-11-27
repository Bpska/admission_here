import { z } from "zod";
import {
  importAccess,
  importError,
  privateHeaders,
} from "@/lib/college-import/http";
import { getImport } from "@/lib/college-import/service";
import { imageLabels } from "@/lib/college-import/image-plan";
import type { Plan } from "@/lib/college-import/validate";
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
        "Image slot",
        "Image source",
        "Image status",
        "Image detail",
        "Stored image URL",
      ],
      ...job.rows.flatMap((row) => {
        const p = row.preview as unknown as Plan;
        const college = [
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
        if (!p.images?.length) return [college.concat("", "", "", "", "")];
        return p.images.map((image) => [
          ...college,
          imageLabels[image.field],
          image.source,
          row.status === "SKIPPED" ? "skipped" : row.status === "FAILED" ? "row failed" : image.status,
          image.message,
          image.url ?? "",
        ]);
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
