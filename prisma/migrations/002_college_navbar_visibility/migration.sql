-- Add opt-in navbar placement without changing existing college visibility.
ALTER TABLE "College" ADD COLUMN IF NOT EXISTS "showInNavbar" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "College" ADD COLUMN IF NOT EXISTS "navbarCategory" TEXT;
