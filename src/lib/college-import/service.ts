import { Prisma } from "@prisma/client";
import { db } from "../db";
import { applyDataMutation } from "../admin-data";
import { validateCustomNavbarFilter } from "../custom-navbar-filters";
import { slugifyCollegeName } from "../college-slug";
import { createHash } from "node:crypto";
import { LIMITS, normalize } from "./fields";
import {
  Catalog,
  Decision,
  ImportOptions,
  Plan,
  loadCatalog,
  mapValues,
  programmeKey,
  safeHtml,
  validateMapping,
  validateRow,
} from "./validate";

const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export const terminal = ["CREATED", "UPDATED", "SKIPPED"];
const message = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError
    ? e.code === "P2002"
      ? "A matching unique record already exists. Revalidate and choose Update or Skip."
      : `Database operation failed (${e.code}). Revalidate and retry this row.`
    : e instanceof Error
      ? e.message
      : "Import failed. Revalidate this row and retry.";
export async function previewRows(
  rows: { rowNumber: number; raw: string[]; decision?: Decision }[],
  mapping: Record<string, string>,
  options: ImportOptions,
  catalog: Catalog,
) {
  const seen = new Set<string>();
  const output = [];
  for (const row of rows) {
    const plan = await validateRow(
      row.raw,
      mapping,
      row.decision,
      options,
      catalog,
    );
    if (!plan.sample && plan.choice.action !== "skip") {
      const values = mapValues(row.raw, mapping);
      const identity =
        plan.choice.action === "update"
          ? `id:${plan.choice.targetId}`
          : [
              normalize(values.name || ""),
              normalize(values.city || ""),
              normalize(values.state || ""),
            ].join("|");
      if (seen.has(identity))
        plan.errors.push(
          "This college appears more than once in the file. Combine its programmes into one row, or skip the duplicate row.",
        );
      seen.add(identity);
    }
    output.push({ ...row, decision: plan.choice, preview: plan });
  }
  return output;
}
export async function getImport(id: string) {
  const job = await db.collegeImport.findUnique({
    where: { id },
    include: { rows: { orderBy: { rowNumber: "asc" } } },
  });
  if (!job) throw new Error("Import not found.");
  const ids = [
    ...new Set(
      job.rows
        .filter(
          (row) =>
            row.collegeId &&
            (row.status === "CREATED" || row.status === "UPDATED"),
        )
        .map((row) => row.collegeId!),
    ),
  ];
  const colleges = ids.length
    ? await db.college.findMany({
        where: { id: { in: ids } },
        select: { id: true, slug: true, name: true, isPublished: true },
      })
    : [];
  return {
    ...job,
    visibility: {
      total: colleges.length,
      published: colleges.filter((college) => college.isPublished).length,
      draft: colleges.filter((college) => !college.isPublished).length,
      missing: ids.length - colleges.length,
      colleges,
    },
  };
}
export async function createImport(
  fileName: string,
  parsed: {
    headers: string[];
    mapping: Record<string, string>;
    rows: { rowNumber: number; raw: string[] }[];
  },
  actor: { userId: string; userName: string },
  publication: { publishOnImport?: boolean } = {},
) {
  // Unknown columns remain visible for manual mapping. Ambiguous alias mapping needs correction first.
  const options = {
    allowUpdates: false,
    allowPublish: Boolean(publication.publishOnImport),
    publishOnImport: Boolean(publication.publishOnImport),
  };
  const catalog = await loadCatalog(db);
  const previews = await previewRows(
    parsed.rows,
    parsed.mapping,
    options,
    catalog,
  );
  try {
    validateMapping(parsed.mapping, parsed.headers);
  } catch (error) {
    for (const row of previews) row.preview.errors.push(message(error));
  }
  return db.collegeImport.create({
    data: {
      actorId: actor.userId,
      actorName: actor.userName,
      fileName: fileName.replace(/[\x00-\x1f]/g, "").slice(0, 200),
      headers: parsed.headers,
      mapping: parsed.mapping,
      options,
      rows: {
        create: previews.map((r) => ({
          rowNumber: r.rowNumber,
          raw: r.raw,
          decision: json(r.decision),
          preview: json(r.preview),
        })),
      },
    },
    include: { rows: { orderBy: { rowNumber: "asc" } } },
  });
}
export async function reviseImport(
  id: string,
  version: number,
  mapping: Record<string, string>,
  options: ImportOptions,
  changes: { rowNumber: number; raw: string[]; decision: Decision }[],
) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      const job = await tx.collegeImport.findUniqueOrThrow({
        where: { id },
        include: { rows: true },
      });
      if (job.status === "IMPORTING")
        throw new Error(
          "The import is running. Wait for the current batch to finish.",
        );
      if (job.version !== version)
        throw new Error(
          "This preview changed in another tab. Reload before editing.",
        );
      validateMapping(mapping, job.headers as string[]);
      if (new Set(changes.map((c) => c.rowNumber)).size !== changes.length)
        throw new Error("Duplicate edited row numbers.");
      if (
        changes.some((c) => !job.rows.some((r) => r.rowNumber === c.rowNumber))
      )
        throw new Error("Unknown row in preview.");
      const editable = job.rows.filter((r) => !terminal.includes(r.status));
      if (
        changes.some((c) =>
          job.rows.some(
            (r) => r.rowNumber === c.rowNumber && terminal.includes(r.status),
          ),
        )
      )
        throw new Error(
          "Completed rows are immutable. Start a new import to change those colleges.",
        );
      const input = editable.map((r) => {
        const change = changes.find((c) => c.rowNumber === r.rowNumber);
        return {
          rowNumber: r.rowNumber,
          raw: (change?.raw || r.raw) as string[],
          decision: (change?.decision || r.decision) as Decision,
        };
      });
      const validated = await previewRows(
        input,
        mapping,
        options,
        await loadCatalog(tx),
      );
      for (const row of validated)
        await tx.collegeImportRow.update({
          where: {
            importId_rowNumber: { importId: id, rowNumber: row.rowNumber },
          },
          data: {
            raw: row.raw,
            decision: json(row.decision),
            preview: json(row.preview),
            status: "PENDING",
            message: null,
          },
        });
      await tx.collegeImport.update({
        where: { id },
        data: {
          version: { increment: 1 },
          mapping,
          options,
          status: "PREVIEW",
        },
      });
      return tx.collegeImport.findUniqueOrThrow({
        where: { id },
        include: { rows: { orderBy: { rowNumber: "asc" } } },
      });
    },
    { timeout: 60000 },
  );
}
function placementHtml(data: any) {
  const lines = [
    ["Highest package (INR)", data.highestPackageInr],
    ["Average package (INR)", data.averagePackageInr],
    ["Median package (INR)", data.medianPackageInr],
    ["Placement percentage", data.placementPercentage],
    ["Total offers", data.totalOffers],
    ["Top recruiters", data.topRecruiters?.join(", ")],
    ["Source", data.sourceUrl],
    ["Cohort notes", data.sourceNote],
  ].filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );
  return (
    `<h3>Batch ${data.batchYear} placements</h3>` +
    lines.map(([label, value]) => safeHtml(`${label}: ${value}`)).join("") +
    (data.photoUrls?.length
      ? safeHtml(`Placement photos: ${data.photoUrls.join("\n")}`)
      : "")
  );
}
async function writePlan(
  tx: Prisma.TransactionClient,
  plan: Plan,
  actorId: string,
) {
  const profile: any = { ...plan.profile };
  delete profile.initialBlog;
  delete profile.onboardingData;
  await validateCustomNavbarFilter(tx, profile);
  let college;
  if (plan.choice.action === "create") {
    if (await tx.college.findUnique({ where: { slug: profile.slug } }))
      profile.slug = `${profile.slug.slice(0, 68).replace(/-$/, "")}-${createHash(
        "sha256",
      )
        .update(
          JSON.stringify([
            profile.name,
            profile.city,
            profile.state,
            profile.websiteUrl,
          ]),
        )
        .digest("hex")
        .slice(0, 10)}`;
    college = await tx.college.create({ data: profile });
  } else
    college = await tx.college.update({
      where: { id: plan.choice.targetId! },
      data: profile,
    });
  let offerings = await tx.collegeCourse.findMany({
    where: { collegeId: college.id },
    include: { course: true },
  });
  for (const { ref, suppliedCourseName, ...data } of plan.programmes) {
    const existing = offerings.find(
      (c) =>
        programmeKey(c.course.degree, c.specialization) ===
        programmeKey(data.degree!, data.specialization),
    );
    const mutation: any = { ...data };
    if (existing && !suppliedCourseName)
      mutation.courseName = existing.course.fullName;
    if (existing && data.durationYrs === undefined)
      mutation.durationYrs = existing.course.durationYrs;
    // Defaults in form schemas must not erase an existing optional list during a partial update.
    if (existing && !data.acceptedExamSlugs?.length)
      delete mutation.acceptedExamSlugs;
    await applyDataMutation(
      tx,
      {
        resource: "offerings",
        operation: existing ? "update" : "create",
        id: existing?.id,
        collegeId: college.id,
        data: mutation,
      },
      actorId,
    );
  }
  offerings = await tx.collegeCourse.findMany({
    where: { collegeId: college.id },
    include: { course: true },
  });
  for (const {
    programmeKey: key,
    collegeCourseId: _,
    ...data
  } of plan.cutoffs) {
    const offering = offerings.find(
      (c) => programmeKey(c.course.degree, c.specialization) === key,
    );
    if (!offering) throw new Error("A cutoff programme could not be resolved.");
    const where = {
      collegeCourseId: offering.id,
      examId: data.examId,
      academicYear: data.academicYear,
      counselingRound: data.counselingRound,
      category: data.category,
      quota: data.quota,
      gender: data.gender,
    };
    const existing = await tx.examCutoff.findFirst({ where });
    await applyDataMutation(
      tx,
      {
        resource: "cutoffs",
        operation: existing ? "update" : "create",
        id: existing?.id,
        collegeId: college.id,
        data: { ...data, collegeCourseId: offering.id },
      },
      actorId,
    );
  }
  for (const { programmeKey: key, ...data } of plan.placements) {
    if (key) {
      const matches = offerings.filter(
        (c) => programmeKey(c.course.degree, c.specialization) === key,
      );
      if (matches.length !== 1)
        throw new Error("A placement programme could not be resolved.");
      const existing = await tx.collegeCourse.findUniqueOrThrow({
        where: { id: matches[0].id },
      });
      const start = `<!--bulk-placement-${data.batchYear}-->`,
        end = `<!--/bulk-placement-${data.batchYear}-->`;
      const previous = (existing.programPlacementHtml || "").replace(
        new RegExp(`${start}[\\s\\S]*?${end}`, "g"),
        "",
      );
      await tx.collegeCourse.update({
        where: { id: existing.id },
        data: {
          programPlacementHtml: previous + start + placementHtml(data) + end,
        },
      });
    } else {
      const { photoUrls, ...rest } = data;
      const existing = await tx.placementStat.findUnique({
        where: {
          collegeId_batchYear: {
            collegeId: college.id,
            batchYear: data.batchYear,
          },
        },
      });
      if (existing)
        await tx.placementStat.update({
          where: { id: existing.id },
          data: {
            ...rest,
            ...(photoUrls ? { photoUrls } : {}),
            ...(!rest.topRecruiters?.length
              ? { topRecruiters: existing.topRecruiters }
              : {}),
          },
        });
      else
        await tx.placementStat.create({
          data: { ...rest, collegeId: college.id, photoUrls: photoUrls || [] },
        });
    }
  }
  for (const data of plan.rankings) {
    const rows = await tx.agencyRanking.findMany({
      where: { collegeId: college.id, rankingYear: data.rankingYear },
    });
    const existing = rows.find(
      (r) =>
        normalize(r.agencyName) === normalize(data.agencyName) &&
        normalize(r.category) === normalize(data.category),
    );
    await applyDataMutation(
      tx,
      {
        resource: "rankings",
        operation: existing ? "update" : "create",
        id: existing?.id,
        collegeId: college.id,
        data,
      },
      actorId,
    );
  }
  if (plan.blog) {
    const { publish, suppliedCategory, suppliedWebsite, ...blog } = plan.blog;
    const existing = (
      await tx.blogPost.findMany({
        where: { relatedCollegeId: college.id },
        select: { id: true, title: true, status: true },
      })
    ).find((b) => normalize(b.title) === normalize(blog.title));
    const slug = `${slugifyCollegeName(`${college.slug}-${blog.title}`).slice(0, 65).replace(/-$/, "")}-${createHash(
      "sha256",
    )
      .update(`${college.id}:${normalize(blog.title)}`)
      .digest("hex")
      .slice(0, 10)}`;
    const data = {
      ...blog,
      ...(publish
        ? { status: "PUBLISHED" as const, publishedAt: new Date() }
        : {}),
    };
    if (existing && !suppliedCategory) delete data.category;
    if (existing && !suppliedWebsite) delete data.showOnWebsiteBlog;
    if (existing)
      await tx.blogPost.update({ where: { id: existing.id }, data });
    else
      await tx.blogPost.create({
        data: {
          ...data,
          slug,
          authorId: actorId,
          relatedCollegeId: college.id,
          status: publish ? "PUBLISHED" : "DRAFT",
        },
      });
  }
  return college.id;
}
async function importOne(id: string, rowId: string) {
  for (let attempt = 0; attempt < 3; attempt++)
    try {
      await db.$transaction(
        async (tx) => {
          // Serialize all importer writes so two jobs cannot create the same college/programme concurrently.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(19341812)`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
          const job = await tx.collegeImport.findUniqueOrThrow({
            where: { id },
          });
          const row = await tx.collegeImportRow.findUniqueOrThrow({
            where: { id: rowId },
          });
          if (
            row.importId !== id ||
            row.status !== "PENDING" ||
            job.status !== "IMPORTING"
          )
            return;
          const plan = await validateRow(
            row.raw as string[],
            job.mapping as Record<string, string>,
            row.decision as unknown as Decision,
            job.options as unknown as ImportOptions,
            await loadCatalog(tx),
          );
          if (plan.errors.length) throw new Error(plan.errors.join("\n"));
          const collegeId =
            plan.choice.action === "skip"
              ? null
              : await writePlan(tx, plan, job.actorId);
          await tx.collegeImportRow.update({
            where: { id: rowId },
            data: {
              preview: json(plan),
              status:
                plan.choice.action === "skip"
                  ? "SKIPPED"
                  : plan.choice.action === "update"
                    ? "UPDATED"
                    : "CREATED",
              collegeId,
              completedAt: new Date(),
              message:
                plan.choice.action === "skip"
                  ? "Skipped by administrator."
                  : "Imported successfully.",
            },
          });
        },
        {
          timeout: 30000,
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
      return;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2034" &&
        attempt < 2
      )
        continue;
      await db.collegeImportRow.updateMany({
        where: { id: rowId, importId: id, status: "PENDING" },
        data: {
          status: "FAILED",
          message: message(e),
          completedAt: new Date(),
        },
      });
      return;
    }
}
export async function runBatch(id: string, version: number) {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
    const job = await tx.collegeImport.findUniqueOrThrow({
      where: { id },
      include: { rows: true },
    });
    if (job.version !== version)
      throw new Error(
        "Preview version changed. Reload and confirm the current preview.",
      );
    if (["COMPLETED", "PARTIAL"].includes(job.status)) return;
    if (job.status !== "IMPORTING") {
      validateMapping(
        job.mapping as Record<string, string>,
        job.headers as string[],
      );
      const pending = job.rows.filter((r) => r.status === "PENDING");
      if (!pending.length) throw new Error("No pending rows.");
      const errors = pending.filter((r) => (r.preview as any).errors?.length);
      if (errors.length)
        throw new Error(
          `${errors.length} row(s) have validation errors. Correct them, or choose Skip, then validate again.`,
        );
      await tx.collegeImport.update({
        where: { id },
        data: { status: "IMPORTING" },
      });
    }
  });
  const rows = await db.collegeImportRow.findMany({
    where: { importId: id, status: "PENDING" },
    orderBy: { rowNumber: "asc" },
    take: LIMITS.batch,
    select: { id: true },
  });
  for (const row of rows) await importOne(id, row.id);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
    if (
      !(await tx.collegeImportRow.count({
        where: { importId: id, status: "PENDING" },
      }))
    ) {
      const failed = await tx.collegeImportRow.count({
        where: { importId: id, status: "FAILED" },
      });
      await tx.collegeImport.updateMany({
        where: { id, status: "IMPORTING" },
        data: { status: failed ? "PARTIAL" : "COMPLETED" },
      });
    }
  });
  return getImport(id);
}
export function summarize(rows: { status: string }[]) {
  return {
    total: rows.length,
    created: rows.filter((r) => r.status === "CREATED").length,
    updated: rows.filter((r) => r.status === "UPDATED").length,
    failed: rows.filter((r) => r.status === "FAILED").length,
    skipped: rows.filter((r) => r.status === "SKIPPED").length,
    pending: rows.filter((r) => r.status === "PENDING").length,
  };
}

/** Creates another preview for previously skipped rows; never writes college data. */
export async function prepareSkippedUpdates(
  id: string,
  version: number,
  actor: { userId: string; userName: string },
) {
  const source = await getImport(id);
  if (source.version !== version)
    throw new Error("This import changed. Reload its latest results first.");
  if (!["COMPLETED", "PARTIAL"].includes(source.status))
    throw new Error("Finish the current import before preparing skipped rows.");
  const rows = source.rows
    .filter(
      (row) =>
        row.status === "SKIPPED" && !(row.preview as unknown as Plan).sample,
    )
    .map((row) => ({ rowNumber: row.rowNumber, raw: row.raw as string[] }));
  if (!rows.length)
    throw new Error("There are no skipped college rows to prepare.");
  return createImport(
    `Updates — ${source.fileName}`,
    {
      headers: source.headers as string[],
      mapping: source.mapping as Record<string, string>,
      rows,
    },
    actor,
  );
}

/** Explicit publication is scoped to successful records in one completed import. */
export async function publishImportedColleges(id: string, version: number) {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
    const job = await tx.collegeImport.findUniqueOrThrow({
      where: { id },
      include: { rows: { select: { status: true, collegeId: true } } },
    });
    if (job.version !== version)
      throw new Error(
        "This import changed. Reload its latest results before publishing.",
      );
    if (!["COMPLETED", "PARTIAL"].includes(job.status))
      throw new Error("Finish the import before publishing its colleges.");
    const ids = [
      ...new Set(
        job.rows
          .filter(
            (row) =>
              row.collegeId &&
              (row.status === "CREATED" || row.status === "UPDATED"),
          )
          .map((row) => row.collegeId!),
      ),
    ];
    if (!ids.length)
      throw new Error(
        "This import has no saved colleges to publish. Skipped rows cannot publish existing colleges.",
      );
    const existing = await tx.college.count({ where: { id: { in: ids } } });
    if (!existing)
      throw new Error(
        "The colleges from this import have been removed. Upload them again before publishing.",
      );
    await tx.college.updateMany({
      where: { id: { in: ids }, isPublished: false },
      data: { isPublished: true },
    });
  });
  return getImport(id);
}
