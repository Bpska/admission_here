import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/auth/staff-guard";
import { db } from "@/lib/db";

export const runtime = "nodejs";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 1024 * 1024;

function imageType(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return "image/png";
  const header = Buffer.from(bytes.subarray(0, 12)).toString("ascii");
  if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) return "image/gif";
  if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function POST(request: Request) {
  const access = await checkAdminAccess("blogs");
  if (!access.allowed) return NextResponse.json({ error: "Blog access is required to upload pictures." }, { status: 403 });
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) return NextResponse.json({ error: "Each picture must be 5 MB or smaller." }, { status: 413 });
  try {
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: "Choose a picture." }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) { await reader.cancel(); return NextResponse.json({ error: "Each picture must be 5 MB or smaller." }, { status: 413 }); }
      chunks.push(value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    const form = await new Response(body, { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a picture." }, { status: 400 });
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Each picture must be 5 MB or smaller." }, { status: 413 });
    const data = new Uint8Array(await file.arrayBuffer());
    const mimeType = imageType(data);
    if (!mimeType || file.type !== mimeType) return NextResponse.json({ error: "Use a JPEG, PNG, GIF or WebP picture." }, { status: 400 });
    const image = await db.blogImage.create({ data: { uploaderId: access.userId, mimeType, size: file.size, data } });
    return NextResponse.json({ url: `/api/v1/blog-images/${image.id}`, id: image.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to upload this picture. Please try again." }, { status: 400 });
  }
}
