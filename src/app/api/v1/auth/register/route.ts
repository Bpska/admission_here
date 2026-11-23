import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { registrationSchema } from "@/lib/auth/account-validation";
import { authRequestAddress, consumeAuthAttempt } from "@/lib/auth/throttle";
import { isSameSiteRequest } from "@/lib/security";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
async function registrationBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return { payload: null, tooLarge: false };
  const decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 8192) { await reader.cancel(); return { payload: null, tooLarge: true }; }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return { payload: JSON.parse(text + decoder.decode()) as unknown, tooLarge: false };
  } catch { return { payload: null, tooLarge: false }; }
  finally { reader.releaseLock(); }
}
export async function POST(request: NextRequest) {
  if (!isSameSiteRequest(request))
    return NextResponse.json(
      { error: "Open registration on this website and try again." },
      { status: 403, headers },
    );
  const body = await registrationBody(request);
  if (body.tooLarge) return NextResponse.json({ error: "Registration details are too large." }, { status: 413, headers });
  const input = registrationSchema.safeParse(body.payload);
  if (!input.success)
    return NextResponse.json(
      {
        error:
          input.error.issues[0]?.message ||
          "Enter your name, email and password.",
      },
      { status: 400, headers },
    );
  try {
    const session = await auth();
    if (session?.user)
      return NextResponse.json(
        { error: "Sign out before creating a different account." },
        { status: 409, headers },
      );
    const limit = await consumeAuthAttempt(
      "register-ip",
      authRequestAddress(request),
      10,
      3600000,
    );
    if (!limit.allowed)
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        {
          status: 429,
          headers: { ...headers, "Retry-After": String(limit.retryAfter) },
        },
      );
    const { name, email, password } = input.data;
    if (
      await db.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true },
      })
    )
      return NextResponse.json(
        { error: "An account already uses this email. Sign in to continue." },
        { status: 409, headers },
      );
    const passwordHash = await bcrypt.hash(password, 12);
    // Public registration always creates a student. No roles or permissions are accepted.
    await db.user.create({
      data: { name, email, passwordHash, role: "STUDENT", isActive: true },
      select: { id: true },
    });
    return NextResponse.json({ success: true }, { status: 201, headers });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return NextResponse.json(
        { error: "An account already uses this email. Sign in to continue." },
        { status: 409, headers },
      );
    console.error(
      "[registration] Unable to create account",
      error instanceof Prisma.PrismaClientKnownRequestError
        ? error.code
        : "UNAVAILABLE",
    );
    return NextResponse.json(
      {
        error: "Account creation is temporarily unavailable. Please try again.",
      },
      { status: 503, headers },
    );
  }
}
