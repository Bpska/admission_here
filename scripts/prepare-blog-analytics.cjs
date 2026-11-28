const fs = require("node:fs/promises");
const path = require("node:path");

// Legacy installations may have been deployed with db push rather than a
// migration baseline. Prepare additive schema changes; never run
// all historical migrations or reset existing data.
async function prepareBlogAnalytics(db) {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(746218309)::text`;
      const [tables] = await tx.$queryRaw`
      SELECT to_regclass('"BlogVisit"')::text AS visits,
             to_regclass('"BlogQualifiedView"')::text AS qualified,
             to_regclass('"CollegeImport"')::text AS imports,
             to_regclass('"CollegeImportRow"')::text AS import_rows,
             to_regclass('"AuthThrottle"')::text AS auth_throttle,
             EXISTS (
               SELECT 1 FROM pg_enum
               WHERE enumtypid = to_regtype('"OwnershipType"')
                 AND enumlabel = 'AIDED'
             ) AS aided_ownership
    `;
      const needed = [
        !tables.visits && "008_blog_visits",
        !tables.qualified && "013_qualified_blog_views",
        (!tables.imports || !tables.import_rows) && "015_college_imports",
        !tables.auth_throttle && "017_user_login",
        !tables.aided_ownership && "018_aided_college_ownership",
      ].filter(Boolean);
      const [ownership] = await tx.$queryRaw`
        SELECT EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'OwnershipType' AND n.nspname = current_schema()
            AND e.enumlabel = 'AIDED'
        ) AS aided
      `;
      if (!ownership.aided) needed.push("018_aided_college_ownership");
      const [profile] = await tx.$queryRaw`
        SELECT to_regclass('"User"')::text AS users,
          EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name = 'User' AND column_name = 'designation') AS designation
      `;
      if (profile.users && !profile.designation)
        needed.push("016_staff_designation");
      for (const migration of needed) {
        const sql = await fs.readFile(
          path.join(
            __dirname,
            "..",
            "prisma",
            "migrations",
            migration,
            "migration.sql",
          ),
          "utf8",
        );
        // These files contain additive schema changes without procedural SQL.
        for (const statement of sql
          .split(";")
          .map((part) => part.trim())
          .filter(Boolean)) {
          // A legacy database can have one import table but not the other.
          // Leave existing tables/indexes intact while repairing the missing ones.
          const additive = statement.replace(
            /^CREATE (TABLE|(?:UNIQUE )?INDEX) (?!IF NOT EXISTS\b)/i,
            "CREATE $1 IF NOT EXISTS ",
          );
          await tx.$executeRawUnsafe(additive);
        }
      }
      // Fail startup clearly if an existing table has incompatible columns.
      await tx.$queryRaw`SELECT "blogId", "visitorHash", "viewCount", "firstSeenAt", "lastViewAt" FROM "BlogVisit" LIMIT 0`;
      await tx.$queryRaw`SELECT "id", "blogId", "visitorHash", "createdAt" FROM "BlogQualifiedView" LIMIT 0`;
      await tx.$queryRaw`SELECT "id", "actorId", "status", "fileName" FROM "CollegeImport" LIMIT 0`;
      await tx.$queryRaw`SELECT "id", "importId", "rowNumber", "status" FROM "CollegeImportRow" LIMIT 0`;
      return needed;
    },
    { maxWait: 10000, timeout: 30000 },
  );
}

module.exports = { prepareBlogAnalytics };
if (require.main === module) {
  require("@next/env").loadEnvConfig(process.cwd());
  const { PrismaClient } = require("@prisma/client");
  const db = new PrismaClient();
  prepareBlogAnalytics(db)
    .then((created) =>
      console.log(
        created.length
          ? "Database schema prepared: " + created.join(", ")
          : "Database schema ready.",
      ),
    )
    .catch((error) => {
      console.error(
        "Database setup failed. Check DATABASE_URL and apply pending migrations.",
        error.code || error.name,
      );
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
