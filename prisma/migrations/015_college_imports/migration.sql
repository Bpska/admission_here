CREATE TABLE "CollegeImport" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "actorId" UUID NOT NULL,
 "actorName" TEXT NOT NULL, "fileName" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PREVIEW',
 "version" INTEGER NOT NULL DEFAULT 1, "headers" JSONB NOT NULL, "mapping" JSONB NOT NULL,
 "options" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CollegeImport_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CollegeImportRow" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "importId" UUID NOT NULL, "rowNumber" INTEGER NOT NULL,
 "raw" JSONB NOT NULL, "decision" JSONB NOT NULL, "preview" JSONB NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING', "collegeId" UUID, "message" TEXT,
 "completedAt" TIMESTAMP(3), CONSTRAINT "CollegeImportRow_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "CollegeImportRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CollegeImport"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CollegeImportRow_importId_rowNumber_key" ON "CollegeImportRow"("importId", "rowNumber");
CREATE INDEX "CollegeImportRow_importId_status_idx" ON "CollegeImportRow"("importId", "status");
