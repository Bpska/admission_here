import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import dns from "node:dns/promises";
import { EventEmitter } from "node:events";
import https from "node:https";
import { Readable } from "node:stream";
import { mock } from "node:test";
import sharp from "sharp";
import { db } from "../src/lib/db";
import {
  downloadImage, verifyImage,
} from "../src/lib/college-import/image-download";
import { MAX_IMAGE_BYTES } from "../src/lib/image-format";
import { autoMapping } from "../src/lib/college-import/fields";
import { createImport, getImport, reviseImport, runBatch } from "../src/lib/college-import/service";
import { collegeTemplate, parseSpreadsheet } from "../src/lib/college-import/spreadsheet";
import ExcelJS from "exceljs";
import { GET as serveImage } from "../src/app/api/v1/blog-images/[id]/route";

async function main() {
  const database = new URL(process.env.DATABASE_URL || "http://invalid");
  assert.equal(database.hostname, "127.0.0.1");
  assert.match(database.pathname, /_test$/, "Use a disposable local test database.");
  const png = await sharp({
    create: { width: 3, height: 3, channels: 3, background: "#3070f0" },
  }).png().toBuffer();
  const webp = await verifyImage(png);
  const replacement = await sharp({
    create: { width: 3, height: 3, channels: 3, background: "#ff7700" },
  }).png().toBuffer();
  await assert.rejects(verifyImage(png.subarray(0, png.length / 2)));
  await assert.rejects(verifyImage(Buffer.from("<svg/>")), /content/);

  const contacted: string[] = [];
  mock.method(dns, "lookup", async (host: string) => {
    if (host === "missing.invalid-host.net") throw Error("DNS lookup failed");
    if (host === "private.fixture.net") return [{ address: "169.254.169.254", family: 4 }];
    if (host === "mixed.fixture.net") return [
      { address: "93.184.216.34", family: 4 }, { address: "127.0.0.1", family: 4 },
    ];
    return [{ address: "93.184.216.34", family: 4 }];
  });
  mock.method(https, "get", (url: URL, options: https.RequestOptions, callback: Function) => {
    assert.equal(options.rejectUnauthorized, true);
    assert.equal(options.agent, false);
    options.lookup!(url.hostname, { family: 4 }, (_error, address) => assert.equal(address, "93.184.216.34"));
    contacted.push(url.href);
    const routes: Record<string, [number, Record<string, string>, Buffer?]> = {
      "/redirect": [302, { location: "/image" }],
      "/redirect-private": [302, { location: "https://private.fixture.net/image" }],
      "/redirect-http": [302, { location: "http://images.fixture.net/image" }],
      "/redirect-loop": [302, { location: "/redirect-loop" }],
      "/missing": [404, {}],
      "/oversize": [200, { "content-length": String(MAX_IMAGE_BYTES + 1) }],
      "/stream-oversize": [200, {}, Buffer.alloc(MAX_IMAGE_BYTES + 1)],
      "/non-image": [200, { "content-type": "image/png" }, Buffer.from("<html>")],
      "/replacement": [200, {}, replacement],
    };
    const [statusCode, headers, bytes] = routes[url.pathname] ?? [200, {}, png];
    queueMicrotask(() => callback(Object.assign(Readable.from(bytes ? [bytes] : []), { statusCode, headers })));
    return new EventEmitter();
  });

  try {
    const retrieve = (url: string) => downloadImage(url, AbortSignal.timeout(10_000));
    assert.deepEqual(await retrieve("https://images.fixture.net/redirect"), webp);
    for (const [url, error] of [
      ["http://images.fixture.net/image", /HTTPS/],
      ["https://images.fixture.net/redirect-private", /public IPv4/],
      ["https://mixed.fixture.net/image", /public IPv4/],
      ["https://images.fixture.net/redirect-http", /HTTPS/],
      ["https://images.fixture.net/redirect-loop", /redirect limit/],
      ["https://missing.invalid-host.net/image", /DNS/],
      ["https://images.fixture.net/missing", /404/],
      ["https://images.fixture.net/oversize", /3 MB/],
      ["https://images.fixture.net/stream-oversize", /3 MB/],
      ["https://images.fixture.net/non-image", /content/],
    ] as const) await assert.rejects(retrieve(url), error);
    assert(!contacted.some((url) => /private\.fixture|mixed\.fixture/.test(url)));
    console.log("PASS HTTPS, pinned public DNS, redirects, missing links, size limits and image content.");

    const tag = `Image Import ${randomUUID().slice(0, 8)}`;
    const actor = await db.user.create({
      data: { name: tag, email: `${randomUUID()}@example.test`, role: "SUPER_ADMIN" },
    });
    const actorInfo = { userId: actor.id, userName: actor.name };
    const template = await parseSpreadsheet(await collegeTemplate(), "template.xlsx");
    assert.equal(template.headers.length, 58);
    for (const [heading, field] of [["Logo Image URL", "logoUrl"], ["Cover Image URL", "coverImageUrl"], ["Gallery Image URLs", "galleryUrls"]])
      assert.equal(template.mapping[template.headers.indexOf(heading)], field);
    const headers = ["College Name", "City", "State", "College Type", "Logo Image URL", "Cover Image URL", "Gallery Image URLs"];
    const root = "https://images.fixture.net";
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Colleges");
    sheet.addRow(headers);
    sheet.addRow([`${tag} 0`, "Test City", "Odisha", "AIDED", `${root}/redirect`, `${root}/missing`, JSON.stringify([`${root}/image`, `${root}/duplicate`])]);
    for (let i = 1; i < 250; i++)
      sheet.addRow([`${tag} ${i}`, "Test City", "Odisha", "AIDED", `${root}/image`, i === 1 ? "http://images.fixture.net/image" : ""]);
    const parsed = await parseSpreadsheet(Buffer.from(await workbook.xlsx.writeBuffer()), "image-test.xlsx");
    const requestsBeforePreview = contacted.length;
    let job = await createImport("image-test.xlsx", parsed, actorInfo);
    assert.equal(contacted.length, requestsBeforePreview);
    assert.equal(job.rows.length, 250);
    const first = await runBatch(job.id, job.version);
    assert.equal(first.status, "IMPORTING");
    assert(first.rows.some((row) => row.status === "CREATED"));
    // Use the saved ledger after an interruption and resume with the same version.
    job = await getImport(job.id);
    for (let i = 0; job.status === "IMPORTING" && i < 60; i++) job = await runBatch(job.id, job.version);
    assert.equal(job.status, "COMPLETED");
    assert(job.rows.every((row) => row.status === "CREATED"));
    const saved = await db.college.findUniqueOrThrow({ where: { id: job.rows[0].collegeId! } });
    const other = await db.college.findUniqueOrThrow({ where: { id: job.rows[1].collegeId! } });
    assert.match(saved.logoUrl!, /^\/api\/v1\/blog-images\//);
    assert.equal(saved.logoUrl, other.logoUrl);
    assert.deepEqual(saved.galleryUrls, [saved.logoUrl]);
    assert.equal(saved.coverImageUrl, null);
    const outcomes = job.rows[0].preview as { images: { status: string }[] };
    assert.deepEqual(outcomes.images.map((image) => image.status), ["saved", "failed", "saved", "saved"]);
    assert.equal(await db.blogImage.count({ where: { uploaderId: actor.id } }), 1);
    await runBatch(job.id, job.version);
    assert.equal(await db.college.count({ where: { name: { startsWith: tag } } }), 250);
    console.log("PASS 250 Excel colleges resumed and saved, with content deduplication and separate image errors.");

    const updateHeaders = [...headers, "College Overview", "Publication Status", "Programmes JSON"];
    const raw = [saved.name, saved.city, saved.state, "PRIVATE", `${root}/replacement`, `${root}/image`,
      JSON.stringify([`${root}/replacement`, `${root}/missing`]), "Changed overview", "Published", "broken JSON"];
    const update = async (replaceImages: boolean) => {
      const pending = await createImport("image-update.xlsx", {
        headers: updateHeaders, mapping: autoMapping(updateHeaders), rows: [{ rowNumber: 2, raw }],
      }, actorInfo);
      const preview = await reviseImport(pending.id, pending.version, pending.mapping as Record<string, string>,
        { imageOnly: true, replaceImages, allowUpdates: true, allowPublish: true, publishOnImport: true },
        [{ rowNumber: 2, raw, decision: { action: "update", confirmed: true, targetId: saved.id } }]);
      assert.deepEqual((preview.rows[0].preview as { errors: string[] }).errors, []);
      const result = await runBatch(preview.id, preview.version);
      assert.equal(result.rows[0].status, "UPDATED", result.rows[0].message ?? "");
      return db.college.findUniqueOrThrow({ where: { id: saved.id } });
    };
    const preserved = await update(false);
    assert.equal(preserved.logoUrl, saved.logoUrl);
    assert.equal(preserved.coverImageUrl, saved.logoUrl);
    raw[5] = "";
    const updated = await update(true);
    assert.notEqual(updated.logoUrl, saved.logoUrl);
    assert.equal(updated.coverImageUrl, preserved.coverImageUrl);
    assert.deepEqual(updated.galleryUrls, saved.galleryUrls);
    assert.equal(updated.ownershipType, saved.ownershipType);
    assert.equal(updated.overviewHtml, saved.overviewHtml);
    assert.equal(updated.isPublished, saved.isPublished);
    assert.equal(await db.college.count({ where: { name: { startsWith: tag } } }), 250);
    assert.equal(await db.blogImage.count({ where: { uploaderId: actor.id } }), 2);
    console.log("PASS image-only update, explicit replacement, blank preservation and safe gallery replacement.");

    await db.college.update({ where: { id: updated.id }, data: { isPublished: true } });
    const imagePath = updated.logoUrl!;
    const imageResponse = await serveImage(new Request(`https://app.fixture.net${imagePath}`), {
      params: Promise.resolve({ id: imagePath.split("/").pop()! }),
    });
    assert.equal(imageResponse.status, 200);
    assert.equal(imageResponse.headers.get("content-type"), "image/webp");
    assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()), await verifyImage(replacement));
    console.log("PASS published college images are served by the existing public image endpoint.");
  } finally {
    mock.restoreAll();
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
