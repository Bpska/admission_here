import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { encode } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const marker = `qa-cms-${randomUUID()}`;
const base = "http://localhost:3000";
async function main() {
  const admin = await db.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN", isActive: true } });
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  assert.ok(secret, "Local auth secret required");
  const token = await encode({ token: { id: admin.id, sub: admin.id, email: admin.email, name: admin.name, role: "SUPER_ADMIN" }, secret, salt: "authjs.session-token", maxAge: 120 });
  const headers = { Cookie: `authjs.session-token=${token}`, "Content-Type": "application/json" };
  try {
    const save = async (body: object) => { const response = await fetch(`${base}/api/v1/cms/blogs`, { method: "POST", headers, body: JSON.stringify(body) }); const json = await response.json(); assert.equal(response.status, 200, json.error); return json.post; };
    const body = { title: marker, category: "CAREER_GUIDE", contentMdx: "<p>A complete draft article for CMS verification.</p>", publish: false, showOnWebsiteBlog: true, faqsJson: [{ question: "How can I apply?", answer: "Use the official application form." }] };
    const first = await save(body);
    assert.equal(first.status, "DRAFT");
    assert.deepEqual((await db.blogPost.findUniqueOrThrow({ where: { id: first.id } })).faqsJson, body.faqsJson);
    const collegeDraft = await save({ ...body, title: `${marker}-college`, showOnWebsiteBlog: false });
    for (const area of ["blogs", "staff-blogs"]) {
      for (const section of ["website", "college"]) {
        const response = await fetch(`${base}/admin/${area}/${section}?q=${marker}`, { headers });
        const html = await response.text();
        assert.equal(response.status, 200);
        assert.ok(html.includes(section === "website" ? first.slug : collegeDraft.slug));
        assert.ok(!html.includes(section === "website" ? collegeDraft.id : first.id), `${area}/${section} excludes the other section's articles`);
        assert.ok(html.includes(`/admin/${area}/new?destination=${section}`));
      }
    }
    await save({ ...body, id: first.id, likesEnabled: false, commentsEnabled: false });
    const disabled = await db.blogPost.findUniqueOrThrow({ where: { id: first.id } });
    assert.equal(disabled.likesEnabled, false); assert.equal(disabled.commentsEnabled, false);
    await save({ ...body, id: first.id });
    assert.equal((await db.blogPost.findUniqueOrThrow({ where: { id: first.id } })).commentsEnabled, false, "Older callers preserve engagement settings");
    const duplicate = await save(body);
    assert.notEqual(duplicate.slug, first.slug, "Duplicate titles get distinct article URLs");
    await save({ ...body, id: first.id, faqsJson: [], featuredImageUrl: "" });
    const updated = await db.blogPost.findUniqueOrThrow({ where: { id: first.id } });
    assert.deepEqual(updated.faqsJson, []); assert.equal(updated.featuredImageUrl, null);
    for (const path of [`/admin/blogs?q=${marker}&status=DRAFT`, `/admin/staff-blogs?q=${marker}`, `/admin/blogs/${first.id}/edit`]) {
      const response = await fetch(base + path, { headers }); const html = await response.text(); assert.equal(response.status, 200); assert.ok(!html.includes('PrismaClientValidationError')); assert.ok(html.includes(marker), `Authenticated page renders article: ${path}`);
      if (path.endsWith("/edit")) { assert.ok(html.includes("Manage likes &amp; comments"), "Moderation link is visible in the editor"); assert.ok(html.includes("Write from a title")); assert.ok(html.includes("Generate from title")); }
    }
    const publicResponse = await fetch(`${base}/blog/${first.slug}`); const html = await publicResponse.text();
    assert.ok(publicResponse.status === 404 || html.includes('NEXT_HTTP_ERROR_FALLBACK;404'), "Draft remains hidden from public readers");
    console.log("CMS HTTP checks passed: authenticated dashboards/editor, FAQ save/removal, unique URLs for duplicate titles, draft visibility, and cleanup.");
  } finally { await db.blogPost.deleteMany({ where: { title: { startsWith: marker }, authorId: admin.id } }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
