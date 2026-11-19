ALTER TABLE "BlogPost" ADD COLUMN "likesEnabled" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "BlogPost" ADD COLUMN "commentsEnabled" BOOLEAN NOT NULL DEFAULT TRUE;
CREATE TABLE "BlogLike" (
 "blogId" UUID NOT NULL REFERENCES "BlogPost"("id") ON DELETE CASCADE,
 "visitorHash" VARCHAR(64) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("blogId", "visitorHash")
);
CREATE TABLE "BlogComment" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 "blogId" UUID NOT NULL REFERENCES "BlogPost"("id") ON DELETE CASCADE,
 "visitorHash" VARCHAR(64) NOT NULL,
 "name" VARCHAR(80) NOT NULL,
 "body" TEXT NOT NULL,
 "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BlogComment_blogId_status_createdAt_idx" ON "BlogComment"("blogId", "status", "createdAt");
CREATE INDEX "BlogComment_visitorHash_createdAt_idx" ON "BlogComment"("visitorHash", "createdAt");
