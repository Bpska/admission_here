CREATE TABLE IF NOT EXISTS "BlogImage" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "uploaderId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BlogImage_uploaderId_idx" ON "BlogImage"("uploaderId");
