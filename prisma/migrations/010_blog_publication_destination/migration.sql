ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "showOnWebsiteBlog" BOOLEAN NOT NULL DEFAULT TRUE;
-- Dedicated articles created for a specific college belong to its own blog section.
UPDATE "BlogPost" SET "showOnWebsiteBlog" = FALSE WHERE "relatedCollegeId" IS NOT NULL;
