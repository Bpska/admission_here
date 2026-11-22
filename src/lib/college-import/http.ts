import { NextResponse } from "next/server";
import { checkAdminAccess } from "../auth/staff-guard";
import { isSameSiteRequest } from "../security";
export async function importAccess(request?: Request) {
  const access = await checkAdminAccess("colleges");
  if (!access.isSuperAdmin || !access.allowed)
    return {
      error: NextResponse.json(
        { error: "Only a Super Administrator may use college imports." },
        { status: 403 },
      ),
      access,
    };
  if (request && request.method !== "GET") {
    if (!isSameSiteRequest(request))
      return {
        error: NextResponse.json(
          { error: "Same-site requests only." },
          { status: 403 },
        ),
        access,
      };
  }
  return { access, error: null };
}
export async function limitedBody(request: Request, max: number) {
  if (Number(request.headers.get("content-length")) > max)
    throw new Error("Request exceeds the upload limit.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Request is empty.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new Error("Request exceeds the upload limit.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export function importError(e: unknown) {
  console.error("Import error detail:", e);
  const message = e instanceof Error ? e.message : "Import request failed.";
  const isMissing = /not found|No .* found/i.test(message);
  const safe = /Prisma|Invalid `|SELECT|ECONN|Authentication failed/i.test(
    message,
  )
    ? "Database request failed. Check the import migration and database connection."
    : message;
  return NextResponse.json(
    { error: safe.slice(0, 3000) },
    { status: isMissing ? 404 : 400, headers: { "Cache-Control": "no-store" } },
  );
}
export const privateHeaders = { "Cache-Control": "private, no-store" };
