import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  importAccess,
  importError,
  limitedBody,
  privateHeaders,
} from "@/lib/college-import/http";
import { publishImportedColleges } from "@/lib/college-import/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await importAccess(request);
  if (error) return error;
  try {
    const { id } = await params;
    z.string().uuid().parse(id);
    const { version } = z
      .object({ confirm: z.literal(true), version: z.number().int().min(1) })
      .strict()
      .parse(JSON.parse((await limitedBody(request, 2048)).toString("utf8")));
    const job = await publishImportedColleges(id, version);
    revalidatePath("/", "layout");
    return NextResponse.json(job, { headers: privateHeaders });
  } catch (error) {
    return importError(error);
  }
}
