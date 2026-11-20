import {
  importAccess,
  importError,
  privateHeaders,
} from "@/lib/college-import/http";
import { collegeTemplate } from "@/lib/college-import/spreadsheet";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const { error } = await importAccess();
  if (error) return error;
  try {
    return new Response(new Uint8Array(await collegeTemplate()), {
      headers: {
        ...privateHeaders,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="Admission_Here_College_Import_Template.xlsx"',
      },
    });
  } catch (e) {
    return importError(e);
  }
}
