import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { db } from "../src/lib/db";
import {
  collegeTemplate,
  parseSpreadsheet,
  safeCsv,
} from "../src/lib/college-import/spreadsheet";
import { autoMapping, importMappingValue } from "../src/lib/college-import/fields";
import {
  createImport,
  getImport,
  reviseImport,
  runBatch,
} from "../src/lib/college-import/service";
import {
  loadCatalog,
  validateMapping,
  validateRow,
  programmeKey,
} from "../src/lib/college-import/validate";

async function main() {
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(process.env.DATABASE_URL || "http://invalid").hostname,
    ),
    "Fixture tests are restricted to a local database.",
  );
  const mark = `Import Test ${randomUUID().slice(0, 8)}`,
    jobs: string[] = [],
    checks: string[] = [];
  function passed(s: string) {
    checks.push(s);
    console.log(`PASS ${s}`);
  }
  async function newJob(headings: string[], rows: string[][]) {
    const parsed = await parseSpreadsheet(
      Buffer.from(safeCsv([headings, ...rows])),
      "test.csv",
    );
    const actor = await db.user.findFirstOrThrow({
      where: { role: "SUPER_ADMIN", isActive: true },
    });
    const job = await createImport("verification.csv", parsed, {
      userId: actor.id,
      userName: "Import verification",
    });
    jobs.push(job.id);
    return job;
  }
  async function finish(job: any) {
    let result: Awaited<ReturnType<typeof getImport>> = job;
    assert.deepEqual(
      job.rows.flatMap((r: any) => r.preview.errors),
      [],
    );
    for (let i = 0; i < 110; i++) {
      result = await runBatch(job.id, job.version);
      if (result.status !== "IMPORTING") return result;
    }
    throw new Error("Import did not finish.");
  }
  const headers = ["College Name", "City", "State", "College Type"];
  try {
    const workbook = await collegeTemplate(),
      parsed = await parseSpreadsheet(workbook, "template.xlsx");
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.headers[0], "Sample Row");
    const excel = new ExcelJS.Workbook();
    await excel.xlsx.load(workbook as any);
    assert.equal(excel.worksheets.length, 1);
    assert.ok(excel.worksheets[0].getCell("E2").dataValidation);
    assert.equal(excel.worksheets[0].views[0].state, "frozen");
    const actor = await db.user.findFirstOrThrow({
      where: { role: "SUPER_ADMIN", isActive: true },
    });
    const sample = await createImport("template.xlsx", parsed, {
      userId: actor.id,
      userName: "Import verification",
    });
    jobs.push(sample.id);
    assert.equal((await finish(sample)).rows[0].status, "SKIPPED");
    passed(
      "Generated single-sheet template parses and safely skips its marked sample",
    );
    const first = await finish(
      await newJob(headers, [
        [`${mark} Single`, "Test City", "Test State", "PRIVATE"],
      ]),
    );
    assert.equal(first.rows[0].status, "CREATED");
    const firstId = first.rows[0].collegeId!;
    assert.equal(
      (await db.college.findUniqueOrThrow({ where: { id: firstId } }))
        .isPublished,
      false,
    );
    passed("One college imports as Draft with missing optional fields");
<<<<<<< HEAD
    const aidedJob = await finish(
      await newJob(headers, [[`${mark} Aided`, "Test City", "Test State", "AIDED"]]),
    );
    assert.equal(aidedJob.rows[0].status, "CREATED");
    const aidedId = aidedJob.rows[0].collegeId!;
    assert.equal((await db.college.findUniqueOrThrow({ where: { id: aidedId } })).ownershipType, "AIDED");
    assert.equal((await runBatch(aidedJob.id, aidedJob.version)).rows[0].collegeId, aidedId);
    assert.equal(await db.college.count({ where: { name: `${mark} Aided` } }), 1);
    const aidedUpdate = await newJob(headers, [[`${mark} Single`, "Test City", "Test State", "Government Aided"]]);
    const aidedUpdated = await finish(await reviseImport(aidedUpdate.id, aidedUpdate.version, aidedUpdate.mapping as Record<string, string>, { allowUpdates: true, allowPublish: false }, [{ rowNumber: 2, raw: aidedUpdate.rows[0].raw as string[], decision: { action: "update", targetId: firstId, confirmed: true } }]));
    assert.equal(aidedUpdated.rows[0].status, "UPDATED");
    assert.equal((await db.college.findUniqueOrThrow({ where: { id: firstId } })).ownershipType, "AIDED");
    passed("Aided colleges are saved, existing ownership updates to Aided, and completed retries do not duplicate colleges");
=======
    const aided = await finish(
      await newJob(headers, [
        [`${mark} Aided`, "Test City", "Test State", "AIDED"],
        [`${mark} Government Aided`, "Test City", "Test State", "Government Aided"],
      ]),
    );
    for (const row of aided.rows) {
      assert.equal(row.status, "CREATED");
      const college = await db.college.findUniqueOrThrow({ where: { id: row.collegeId! } });
      assert.equal(college.ownershipType, "AIDED");
    }
    passed("AIDED and Government Aided both save as AIDED");
>>>>>>> bf39c3e1d53886ab5c3cf73c54160c1ed20f9878
    const batch = await finish(
      await newJob(
        headers,
        Array.from({ length: 100 }, (_, i) => [
          `${mark} Batch ${i}`,
          "Test City",
          "Test State",
          "PRIVATE",
        ]),
      ),
    );
    assert.equal(batch.rows.filter((r) => r.status === "CREATED").length, 100);
    const repeated = await runBatch(batch.id, batch.version);
    assert.equal(
      repeated.rows.filter((r) => r.status === "CREATED").length,
      100,
    );
    passed(
      "100 colleges import through recoverable batches; repeating confirmation is retry-safe",
    );
    const duplicate = await finish(
      await newJob(headers, [
        [`${mark} Single`, "Test City", "Test State", "PRIVATE"],
      ]),
    );
    assert.equal(duplicate.rows[0].status, "SKIPPED");
    passed("Existing college defaults to Skip");
    await db.college.update({
      where: { id: firstId },
      data: {
        contactEmail: "preserve@example.org",
        overviewHtml: "<p>Preserve this overview</p>",
      },
    });
    const update = await newJob(
      ["College Name", "City", "State", "Email", "Phone"],
      [[`${mark} Single`, "Test City", "Test State", "", "1234567890"]],
    );
    const revised = await reviseImport(
      update.id,
      update.version,
      update.mapping as Record<string, string>,
      { allowUpdates: true, allowPublish: false },
      [
        {
          rowNumber: 2,
          raw: update.rows[0].raw as string[],
          decision: { action: "update", targetId: firstId, confirmed: true },
        },
      ],
    );
    const updated = await finish(revised);
    assert.equal(updated.rows[0].status, "UPDATED");
    const saved = await db.college.findUniqueOrThrow({
      where: { id: firstId },
    });
    assert.equal(saved.contactEmail, "preserve@example.org");
    assert.equal(saved.overviewHtml, "<p>Preserve this overview</p>");
    assert.equal(saved.contactPhone, "1234567890");
    passed("Explicit existing-college update preserves blank optional values");
    const programmes = [
      {
        ref: "BT",
        courseName: `${mark} BTech`,
        degree: "B.Tech",
        stream: "Engineering",
        level: "UG",
        specialization: "CSE",
        totalFeesInr: 400000,
      },
      {
        ref: "MBA",
        courseName: `${mark} MBA`,
        degree: "MBA",
        stream: "Management",
        level: "PG",
        specialization: "General",
        totalFeesInr: 200000,
      },
      {
        ref: "MCA",
        courseName: `${mark} MCA`,
        degree: "MCA",
        stream: "Computer Applications",
        level: "PG",
        specialization: "General",
        totalFeesInr: 150000,
      },
    ];
    const multi = await finish(
      await newJob(
        [
          ...headers,
          "Programmes JSON",
          "Placements JSON",
          "FAQs JSON",
          "College Blog Title",
          "College Blog Content",
        ],
        [
          [
            `${mark} Multi`,
            "Test City",
            "Test State",
            "PRIVATE",
            JSON.stringify(programmes),
            JSON.stringify([
              { programme: "MCA", batchYear: 2026, highestPackageInr: 900000 },
            ]),
            JSON.stringify([
              { question: "Courses?", answer: "B.Tech, MBA and MCA." },
            ]),
            `${mark} Article`,
            "Verified college-specific article text.",
          ],
        ],
      ),
    );
    assert.equal(multi.rows[0].status, "CREATED");
    const multiId = multi.rows[0].collegeId!;
    const courses = await db.collegeCourse.findMany({
      where: { collegeId: multiId },
      include: { course: true },
    });
    assert.equal(courses.length, 3);
    assert.equal(
      courses.find((c) => c.course.degree === "MCA")?.totalFeesInr,
      150000,
    );
    assert.match(
      courses.find((c) => c.course.degree === "MCA")?.programPlacementHtml ||
        "",
      /900000/,
    );
    assert.equal(
      courses.find((c) => c.course.degree === "B.Tech")?.programPlacementHtml,
      null,
    );
    assert.equal(
      await db.placementStat.count({ where: { collegeId: multiId } }),
      0,
    );
    assert.equal(
      await db.blogPost.count({
        where: {
          relatedCollegeId: multiId,
          status: "DRAFT",
          showOnWebsiteBlog: false,
        },
      }),
      1,
    );
    passed(
      "One college links B.Tech, MBA and MCA, isolated programme placements, FAQs and college-only draft blog",
    );
    const exam = await db.exam.findFirstOrThrow();
    const withCutoffs = await newJob(
      [
        ...headers,
        "Programmes JSON",
        "Cutoffs JSON",
        "Placements JSON",
        "Rankings JSON",
      ],
      [
        [
          `${mark} Multi`,
          "Test City",
          "Test State",
          "PRIVATE",
          JSON.stringify(programmes),
          JSON.stringify([
            {
              programme: "MCA",
              entranceExam: exam.slug,
              academicYear: 2026,
              counselingRound: 1,
              category: "GEN",
              openingRank: 10,
              closingRank: 100,
            },
          ]),
          JSON.stringify([{ batchYear: 2026, highestPackageInr: 1000000 }]),
          JSON.stringify([
            {
              agencyName: "Test Agency",
              category: "Overall",
              rankingYear: 2026,
              rankNumber: 10,
            },
          ]),
        ],
      ],
    );
    async function updateMulti(job: any) {
      return reviseImport(
        job.id,
        job.version,
        job.mapping,
        { allowUpdates: true, allowPublish: false },
        [
          {
            rowNumber: 2,
            raw: job.rows[0].raw,
            decision: { action: "update", targetId: multiId, confirmed: true },
          },
        ],
      );
    }
    assert.equal(
      (await finish(await updateMulti(withCutoffs))).rows[0].status,
      "UPDATED",
    );
    const again = await newJob(
      [
        ...headers,
        "Programmes JSON",
        "Cutoffs JSON",
        "Placements JSON",
        "Rankings JSON",
      ],
      [withCutoffs.rows[0].raw as string[]],
    );
    assert.equal(
      (await finish(await updateMulti(again))).rows[0].status,
      "UPDATED",
    );
    assert.equal(
      await db.collegeCourse.count({ where: { collegeId: multiId } }),
      3,
    );
    assert.equal(
      await db.examCutoff.count({
        where: { collegeCourse: { collegeId: multiId } },
      }),
      0,
    );
    assert.equal(
      await db.placementStat.count({ where: { collegeId: multiId } }),
      1,
    );
    assert.equal(
      await db.agencyRanking.count({ where: { collegeId: multiId } }),
      0,
    );
    passed(
      "Repeated programmes/placements update matching records; unmapped cutoff/ranking columns are ignored",
    );
    const catalog = await loadCatalog(db),
      map = autoMapping([...headers, "Programmes JSON"]);
    const base = [`${mark} Invalid`, "Test City", "Test State", "PRIVATE"];
    const bad = await validateRow(
      [...base, "[{bad json"],
      map,
      { action: "create" },
      { allowUpdates: false, allowPublish: false },
      catalog,
    );
    assert.ok(bad.errors.some((e) => e.includes("malformed JSON")));
    passed("Malformed JSON reports an actionable row error");
    const doubled = await validateRow(
      [...base, JSON.stringify([programmes[0], programmes[0]])],
      map,
      { action: "create" },
      { allowUpdates: false, allowPublish: false },
      catalog,
    );
    assert.ok(doubled.errors.some((e) => e.includes("Duplicate programme")));
    passed("Duplicate programme entries are rejected before writing");
    const other = autoMapping([
      "Unrecognized Institution",
      "City",
      "State",
      "College Type",
    ]);
    assert.equal(other[0], "");
    assert.throws(() =>
      validateMapping(other, [
        "Unrecognized Institution",
        "City",
        "State",
        "College Type",
      ]),
    );
    other[0] = "name";
    validateMapping(other, [
      "Unrecognized Institution",
      "City",
      "State",
      "College Type",
    ]);
    passed("Unknown columns remain unmapped and can be corrected manually");
    const formulas = new ExcelJS.Workbook();
    const sheet = formulas.addWorksheet("Colleges");
    sheet.addRow(headers);
    sheet.addRow([{ formula: "1+1" }, "Test City", "Test State", "PRIVATE"]);
    await assert.rejects(() => parseSpreadsheet(Buffer.from([]), "bad.xlsx"));
    await assert.rejects(() =>
      parseSpreadsheet(Buffer.from("not excel"), "bad.xls"),
    );
    await assert.rejects(() => parseSpreadsheet(Buffer.from([]), "x.csv"));
    await assert.rejects(
      async () =>
        parseSpreadsheet(
          Buffer.from(await formulas.xlsx.writeBuffer()),
          "formula.xlsx",
        ),
      /formulas/,
    );
    passed("Invalid files and formula cells are rejected");
    const conflict = await newJob(headers, [
      [`${mark} Twice`, "Test City", "Test State", "PRIVATE"],
      [`${mark} Twice`, "Test City", "Test State", "PRIVATE"],
    ]);
    assert.ok((conflict.rows[1].preview as any).errors.length);
    await assert.rejects(
      () => runBatch(conflict.id, conflict.version),
      /validation errors/,
    );
    passed("Duplicate colleges within a file block confirmation");
    // Inject a write failure into this process only, after the college has been created.
    const rollback = await newJob(
      [...headers, "Placements JSON"],
      [
        [
          `${mark} Rollback`,
          "Test City",
          "Test State",
          "PRIVATE",
          JSON.stringify([
            {
              batchYear: 2026,
              highestPackageInr: 1000000,
            },
          ]),
        ],
      ],
    );
    const original = db.$transaction.bind(db);
    (db as any).$transaction = (fn: any, opts: any) =>
      original(
        async (tx: any) =>
          fn(
            new Proxy(tx, {
              get(target, key) {
                if (key === "placementStat")
                  return new Proxy(target.placementStat, {
                    get(model, k) {
                      if (k === "create")
                        return async () => {
                          throw new Error("Injected row write failure");
                        };
                      return model[k];
                    },
                  });
                return target[key];
              },
            }),
          ),
        opts,
      );
    try {
      const rolled = await finish(rollback);
      assert.equal(rolled.rows[0].status, "FAILED");
      assert.equal(
        await db.college.count({ where: { name: `${mark} Rollback` } }),
        0,
      );
    } finally {
      (db as any).$transaction = original;
    }
    const retry = await getImport(rollback.id);
    const retryReady = await reviseImport(
      retry.id,
      retry.version,
      retry.mapping as Record<string, string>,
      { allowUpdates: false, allowPublish: false },
      [],
    );
    assert.equal((await finish(retryReady)).rows[0].status, "CREATED");
    passed(
      "A mid-write failure rolls back the whole college; failed rows retry without duplicating completed work",
    );
    const management = await db.college.findMany({
      where: {
        id: multiId,
        courses: { some: { course: { stream: "Management" } } },
      },
      include: {
        courses: {
          where: { course: { stream: "Management" } },
          include: { course: true },
        },
      },
    });
    assert.equal(management[0].courses.length, 1);
    assert.equal(management[0].courses[0].course.degree, "MBA");
    assert.equal(programmeKey("MCA", "General"), "mca:general");
    passed("Programme-based database filters isolate the correct degree");
    const safeguards = await validateRow(
      [`${mark} Publish`, "Test City", "Test State", "PRIVATE", "Published"],
      autoMapping([...headers, "Publication Status"]),
      { action: "create" },
      { allowUpdates: false, allowPublish: false },
      await loadCatalog(db),
    );
    assert.ok(safeguards.errors.some((e) => e.includes("Publishing requires")));
    passed("Publishing requires explicit administrator permission");
    const publicChoice = await validateRow(
      [`${mark} Public Choice`, "Test City", "Test State", "PRIVATE", "Draft"],
      autoMapping([...headers, "Publication Status"]),
      { action: "create" },
      { allowUpdates: false, allowPublish: true, publishOnImport: true },
      await loadCatalog(db),
    );
    assert.deepEqual(publicChoice.errors, []);
    assert.equal(publicChoice.profile.isPublished, true);
    const unsafeChoice = await validateRow(
      [`${mark} Denied Choice`, "Test City", "Test State", "PRIVATE", "Draft"],
      autoMapping([...headers, "Publication Status"]),
      { action: "create" },
      { allowUpdates: false, allowPublish: false, publishOnImport: true },
      await loadCatalog(db),
    );
    assert.ok(
      unsafeChoice.errors.some((error) =>
        error.includes("publishing permission"),
      ),
    );
    passed(
      "Publish-on-confirm overrides template Draft only with explicit publication permission",
    );
    const blockedUpdate = await validateRow(
      [`${mark} Single`, "Test City", "Test State", "PRIVATE"],
      autoMapping(headers),
      { action: "update", targetId: firstId, confirmed: false },
      { allowUpdates: false, allowPublish: false },
      await loadCatalog(db),
    );
    assert.ok(blockedUpdate.errors.length >= 2);
    passed(
      "Updates require both job permission and a confirmed matching target",
    );
    const clear = await newJob(
      ["College Name", "City", "State"],
      [[`${mark} Single`, "Test City", "Test State"]],
    );
    const clearReady = await reviseImport(
      clear.id,
      clear.version,
      clear.mapping as Record<string, string>,
      { allowUpdates: true, allowPublish: false },
      [
        {
          rowNumber: 2,
          raw: clear.rows[0].raw as string[],
          decision: {
            action: "update",
            targetId: firstId,
            confirmed: true,
            clearFields: ["contactEmail"],
          },
        },
      ],
    );
    assert.equal((await finish(clearReady)).rows[0].status, "UPDATED");
    assert.equal(
      (await db.college.findUniqueOrThrow({ where: { id: firstId } }))
        .contactEmail,
      null,
    );
    await assert.rejects(
      () =>
        reviseImport(
          clear.id,
          clear.version,
          clear.mapping as Record<string, string>,
          { allowUpdates: true, allowPublish: false },
          [],
        ),
      /another tab/,
    );
    passed(
      "Explicit field clearing works, and stale preview edits are rejected",
    );
    await assert.rejects(
      () =>
        parseSpreadsheet(
          Buffer.from(
            safeCsv([
              headers,
              ...Array.from({ length: 501 }, () => [
                "Too many",
                "City",
                "State",
                "PRIVATE",
              ]),
            ]),
          ),
          "too-many.csv",
        ),
      /500/,
    );
    passed("Oversized row counts are rejected");
    await assert.rejects(
      () =>
        parseSpreadsheet(
          Buffer.from(
            "College Name,City,State\nCollege, Unquoted name,City,State",
          ),
          "misaligned.csv",
        ),
      /more values than headings/,
    );
    passed(
      "Misaligned CSV rows are rejected instead of silently losing extra values",
    );
    const autoRefs = await validateRow(
      [
        ...base,
        JSON.stringify([
          { ...programmes[0], ref: undefined },
          {
            ...programmes[0],
            ref: undefined,
            specialization: "Mechanical Engineering",
          },
        ]),
      ],
      map,
      { action: "create" },
      { allowUpdates: false, allowPublish: false },
      await loadCatalog(db),
    );
    assert.deepEqual(autoRefs.errors, []);
    assert.equal(autoRefs.programmes.length, 2);
    passed(
      "Multiple specializations generate their own references when ref is omitted",
    );
    const htmlJob = await newJob(
      [...headers, "College Overview"],
      [
        [
          `${mark} Safe HTML`,
          "Test City",
          "Test State",
          "PRIVATE",
          "<p>Safe content</p><script>alert(1)</script><img src=x onerror=alert(1)>",
        ],
      ],
    );
    assert.equal(
      (htmlJob.rows[0].preview as any).profile.overviewHtml,
      "<p>Safe content</p>",
    );
    passed(
      "Unsafe HTML and executable attributes are removed during validation",
    );
    await db.college.update({
      where: { id: multiId },
      data: { facilitiesJson: ["Sports: Field", "Wi-Fi: Entire campus"] },
    });
    await db.blogPost.updateMany({
      where: { relatedCollegeId: multiId },
      data: { category: "SCHOLARSHIP", showOnWebsiteBlog: true },
    });
    const aggregate = await newJob(
      [
        "College Name",
        "City",
        "State",
        "Library",
        "College Blog Title",
        "College Blog Content",
        "Programmes JSON",
      ],
      [
        [
          `${mark} Multi`,
          "Test City",
          "Test State",
          "Reference library",
          `${mark} Article`,
          "Updated article content, retaining saved optional settings.",
          JSON.stringify([
            { degree: "MCA", specialization: "General", totalFeesInr: 160000 },
          ]),
        ],
      ],
    );
    assert.equal(
      (await finish(await updateMulti(aggregate))).rows[0].status,
      "UPDATED",
    );
    const partialCollege = await db.college.findUniqueOrThrow({
      where: { id: multiId },
      include: { courses: { include: { course: true } }, blogPosts: true },
    });
    assert.deepEqual(partialCollege.facilitiesJson, [
      "Sports: Field",
      "Wi-Fi: Entire campus",
      "Library: Reference library",
    ]);
    passed(
      "A partial facility update preserves facilities whose cells were blank",
    );
    assert.equal(partialCollege.blogPosts[0].category, "SCHOLARSHIP");
    assert.equal(partialCollege.blogPosts[0].showOnWebsiteBlog, true);
    assert.equal(
      partialCollege.courses.find((c) => c.course.degree === "MCA")?.course
        .fullName,
      `${mark} MCA`,
    );
    assert.equal(
      partialCollege.courses.find((c) => c.course.degree === "MCA")
        ?.totalFeesInr,
      160000,
    );
    assert.equal(partialCollege.courses.length, 3);
    passed(
      "Partial programme and article updates preserve omitted course names and blog settings",
    );
    await db.college.update({
      where: { id: multiId },
      data: { nirfRank: 123 },
    });
    await db.agencyRanking.create({
      data: {
        collegeId: multiId,
        agencyName: "Preserved legacy",
        category: "Overall",
        rankingYear: 2026,
        rankNumber: 123,
      },
    });
    await db.examCutoff.create({
      data: {
        collegeCourseId: courses[0].id,
        examId: exam.id,
        academicYear: 2026,
        counselingRound: 1,
        category: "GEN",
        quota: "AI",
        gender: "Gender-Neutral",
        closingRank: 100,
      },
    });
    const legacy = await newJob(
      [
        "College Name",
        "City",
        "State",
        "NIRF Rank",
        "Cutoffs JSON",
        "Rankings JSON",
      ],
      [
        [
          `${mark} Multi`,
          "Test City",
          "Test State",
          "999",
          "malformed old data",
          "malformed old data",
        ],
      ],
    );
    assert.equal(
      (await finish(await updateMulti(legacy))).rows[0].status,
      "UPDATED",
    );
    assert.equal(
      (await db.college.findUniqueOrThrow({ where: { id: multiId } })).nirfRank,
      123,
    );
    assert.equal(
      await db.agencyRanking.count({ where: { collegeId: multiId } }),
      1,
    );
    assert.equal(
      await db.examCutoff.count({
        where: { collegeCourse: { collegeId: multiId } },
      }),
      1,
    );
    passed(
      "Removed legacy spreadsheet fields are ignored and existing cutoff/ranking records remain unchanged",
    );
    const manual = await newJob(
      [...withCutoffs.headers as string[], "NIRF Rank"],
      [[...withCutoffs.rows[0].raw as string[], "124"]],
    );
    const manualMapping = {
      ...manual.mapping as Record<string, string>,
      5: importMappingValue("cutoffs"),
      7: importMappingValue("rankings"),
      8: importMappingValue("nirfRank"),
    };
    assert.equal((await finish(await updateMulti({
      ...manual,
      mapping: manualMapping,
    }))).rows[0].status, "UPDATED");
    assert.equal(
      (await db.college.findUniqueOrThrow({ where: { id: multiId } })).nirfRank,
      124,
    );
    assert.equal(await db.agencyRanking.count({
      where: { collegeId: multiId, agencyName: "Test Agency", rankNumber: 10 },
    }), 1);
    assert.equal(await db.examCutoff.count({
      where: { collegeCourse: { collegeId: multiId }, openingRank: 10 },
    }), 1);
    passed("Explicit mappings validate and save NIRF rank, cutoff and ranking data");
    console.log(
      `${checks.length} importer checks passed. Temporary fixtures will now be removed.`,
    );
  } finally {
    const colleges = await db.college.findMany({
      where: { name: { startsWith: mark } },
      select: { id: true },
    });
    const ids = colleges.map((c) => c.id);
    await db.blogPost.deleteMany({ where: { relatedCollegeId: { in: ids } } });
    await db.college.deleteMany({ where: { id: { in: ids } } });
    await db.collegeImport.deleteMany({ where: { id: { in: jobs } } });
    await db.course.deleteMany({
      where: { fullName: { startsWith: mark }, offerings: { none: {} } },
    });
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
