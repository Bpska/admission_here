import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  importAccess,
  importError,
  limitedBody,
  privateHeaders,
} from "@/lib/college-import/http";
import { LIMITS } from "@/lib/college-import/fields";
import { parseSpreadsheet } from "@/lib/college-import/spreadsheet";
import { createImport, ensureImportSchema, summarize } from "@/lib/college-import/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const { error } = await importAccess();
  if (error) return error;
  try {
    await ensureImportSchema();
    const url = new URL(request.url);
    const page = Math.max(
      1,
      Math.min(10000, Math.trunc(Number(url.searchParams.get("page"))) || 1),
    );
    const [jobs, total] = await Promise.all([
      db.collegeImport.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * 20,
        take: 20,
        include: { rows: { select: { status: true } } },
      }),
      db.collegeImport.count(),
    ]);
    return NextResponse.json(
      {
        total,
        page,
        jobs: jobs.map(({ rows, ...j }) => ({
          ...j,
          summary: summarize(rows),
        })),
      },
      { headers: privateHeaders },
    );
  } catch (e) {
    return importError(e);
  }
}
export async function POST(request: Request) {
  const { access, error } = await importAccess(request);
  if (error) return error;
  try {
    const bytes = await limitedBody(request, LIMITS.bytes + 1024 * 1024);
    const form = await new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File))
      throw new Error("Choose an .xlsx or .csv file.");
    const parsed = await parseSpreadsheet(
      Buffer.from(await file.arrayBuffer()),
      file.name,
    );
    const flag = form.get("publishOnImport");
    if (flag !== null && flag !== "true" && flag !== "false")
      throw new Error("Invalid publication choice.");
    const job = await createImport(file.name, parsed, access, {
      publishOnImport: flag === "true",
    });
    return NextResponse.json(job, { status: 201, headers: privateHeaders });
  } catch (e) {
    return importError(e);
  }
}
