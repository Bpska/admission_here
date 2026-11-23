import { createHmac } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export function authAttemptKey(scope: string, value: string) {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "development-only-auth-throttle";
  return createHmac("sha256", secret).update(`${scope}:${value}`).digest("hex");
}
export function authRequestAddress(request: Request) {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    "unknown"
  )
    .trim()
    .slice(0, 200);
}
/** Atomic, shared limits survive restarts and multiple application instances. */
export async function consumeAuthAttempt(
  scope: string,
  value: string,
  limit: number,
  windowMs: number,
) {
  const key = authAttemptKey(scope, value);
  await db.authThrottle.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  const [row] = await db.$queryRaw<
    { attempts: number; expiresAt: Date }[]
  >(Prisma.sql`
    INSERT INTO "AuthThrottle" ("key", "attempts", "expiresAt", "updatedAt")
    VALUES (${key}, 1, CURRENT_TIMESTAMP + (${windowMs}::bigint * INTERVAL '1 millisecond'), CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "AuthThrottle"."expiresAt" <= CURRENT_TIMESTAMP THEN 1
        ELSE LEAST("AuthThrottle"."attempts" + 1, ${limit + 1}) END,
      "expiresAt" = CASE WHEN "AuthThrottle"."expiresAt" <= CURRENT_TIMESTAMP THEN EXCLUDED."expiresAt"
        ELSE "AuthThrottle"."expiresAt" END,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "attempts", "expiresAt"
  `);
  return {
    allowed: row.attempts <= limit,
    retryAfter: Math.max(
      1,
      Math.ceil((row.expiresAt.getTime() - Date.now()) / 1000),
    ),
  };
}
