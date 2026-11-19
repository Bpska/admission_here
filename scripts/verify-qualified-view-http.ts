import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const author = await db.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN", isActive: true } });
  const marker = `qa-qualified-view-${randomUUID()}`;
  const post = await db.blogPost.create({ data: { slug: marker, title: marker, contentMdx: "<p>Active view verification fixture</p>", category: "CAREER_GUIDE", authorId: author.id, status: "DRAFT" } });
  const endpoint = `http://localhost:3000/api/v1/blogs/${post.id}/views`;
  let cookie = "";
  const send = async (body: object, extra: Record<string, string> = {}) => {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie, "User-Agent": "Mozilla/5.0", ...extra }, body: JSON.stringify(body) });
    const setCookie = response.headers.get("set-cookie"); if (setCookie) cookie = setCookie.split(";")[0];
    return { status: response.status, data: response.status === 204 ? null : await response.json() };
  };
  try {
    assert.equal((await send({ action: "start" })).status, 404);
    await db.blogPost.update({ where: { id: post.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    assert.equal((await send({ action: "start" }, { "User-Agent": "Googlebot" })).status, 204);
    assert.equal((await send({ action: "start" }, { Origin: "https://different.example" })).status, 403);
    const start = await send({ action: "start" }); assert.equal(start.status, 200); assert.ok(start.data.ticket);
    const ticket = start.data.ticket;
    assert.equal(await db.blogVisit.count({ where: { blogId: post.id } }), 0, "Opening the article does not immediately count");
    assert.equal((await send({ action: "complete", ticket, activeMs: 45000 })).status, 400, "The server rejects an immediate claim of 45 active seconds");
    assert.equal((await send({ action: "complete", ticket: ticket + "bad", activeMs: 45000 })).status, 400);
    console.log("Waiting 45 seconds to verify the real qualification threshold…");
    await new Promise(resolve => setTimeout(resolve, 45100));
    assert.equal((await send({ action: "complete", ticket, activeMs: 44999 })).status, 400);
    const submissions = await Promise.all(Array.from({ length: 3 }, () => send({ action: "complete", ticket, activeMs: 45000 })));
    assert.ok(submissions.every(result => result.status === 200));
    assert.equal(submissions.filter(result => result.data.counted).length, 1);
    assert.equal(await db.blogQualifiedView.count({ where: { blogId: post.id } }), 1);
    const aggregate = await db.blogVisit.findFirstOrThrow({ where: { blogId: post.id } }); assert.equal(aggregate.viewCount, 1);
    const another = await send({ action: "start" }); assert.notEqual(another.data.ticket, ticket);
    assert.equal((await send({ action: "complete", ticket: another.data.ticket, activeMs: 45000 })).status, 400, "A return visit must qualify separately");
    console.log("Qualified view HTTP checks passed: no count on open, 45-second server threshold, active-time validation, signed tokens, duplicate retries, bot exclusion and a fresh threshold for return visits.");
  } finally { await db.blogPost.deleteMany({ where: { id: post.id } }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
