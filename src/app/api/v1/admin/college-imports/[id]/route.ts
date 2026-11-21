import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  importAccess,
  importError,
  limitedBody,
  privateHeaders,
} from "@/lib/college-import/http";
import { DecisionSchema, OptionsSchema } from "@/lib/college-import/validate";
import { LIMITS } from "@/lib/college-import/fields";
import {
  getImport,
  reviseImport,
  runBatch,
} from "@/lib/college-import/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Context) {
  const { error } = await importAccess();
  if (error) return error;
  try {
    const { id } = await params;
    z.string().uuid().parse(id);
    return NextResponse.json(await getImport(id), { headers: privateHeaders });
  } catch (e) {
    return importError(e);
  }
}
export async function PATCH(request: Request, { params }: Context) {
  const { error } = await importAccess(request);
  if (error) return error;
  try {
    const { id } = await params;
    z.string().uuid().parse(id);
    const data = z
      .object({
        version: z.number().int().min(1),
        mapping: z.record(z.string()),
        options: OptionsSchema,
        rows: z
          .array(
            z
              .object({
                rowNumber: z.number().int().min(2),
                raw: z.array(z.string().max(LIMITS.cell)).max(LIMITS.columns),
                decision: DecisionSchema,
              })
              .strict(),
          )
          .max(LIMITS.rows),
      })
      .strict()
      .parse(
        JSON.parse(
          (await limitedBody(request, LIMITS.bytes * 2)).toString("utf8"),
        ),
      );
    return NextResponse.json(
      await reviseImport(
        id,
        data.version,
        data.mapping,
        data.options,
        data.rows,
      ),
      { headers: privateHeaders },
    );
  } catch (e) {
    return importError(e);
  }
}
export async function POST(request: Request, { params }: Context) {
  const { error } = await importAccess(request);
  if (error) return error;
  try {
    const { id } = await params;
    z.string().uuid().parse(id);
    const data = z
      .object({ confirm: z.literal(true), version: z.number().int().min(1) })
      .strict()
      .parse(JSON.parse((await limitedBody(request, 2048)).toString("utf8")));
    const job = await runBatch(id, data.version);
    if (job.status === "COMPLETED" || job.status === "PARTIAL")
      revalidatePath("/", "layout");
    const response =
      new URL(request.url).searchParams.get("view") === "progress"
        ? {
            id: job.id,
            status: job.status,
            version: job.version,
            visibility: job.visibility,
            rows: job.rows.map(({ id, status, collegeId, message }) => ({
              id,
              status,
              collegeId,
              message,
            })),
          }
        : job;
    return NextResponse.json(response, { headers: privateHeaders });
  } catch (e) {
    return importError(e);
  }
}
