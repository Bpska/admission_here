CREATE TABLE "BlogQualifiedView" (
 "id" UUID PRIMARY KEY,
 "blogId" UUID NOT NULL REFERENCES "BlogPost"("id") ON DELETE CASCADE,
 "visitorHash" VARCHAR(64) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BlogQualifiedView_blogId_idx" ON "BlogQualifiedView"("blogId");
