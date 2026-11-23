CREATE TABLE IF NOT EXISTS "AuthThrottle" (
  "key" VARCHAR(64) PRIMARY KEY,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AuthThrottle_expiresAt_idx" ON "AuthThrottle"("expiresAt");
