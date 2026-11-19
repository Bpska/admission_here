import assert from "node:assert/strict";
import { encode } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";
import { BlogDraftSchema, starterBlogDraft } from "../src/lib/blog-draft";
const db = new PrismaClient();
async function main() {
  for (const title of ["B.Tech admission guide", "How to compare engineering cutoffs", "Scholarship application documents", "Understanding placement reports", "Choosing a career after MBA", "Student planning checklist"]) {
    const draft = starterBlogDraft(title);
    assert.ok(BlogDraftSchema.safeParse(draft).success);
    assert.equal(draft.title, title); assert.ok(draft.contentHtml.includes("<h2>")); assert.ok(draft.contentHtml.length > 1000); assert.ok(draft.tags.length); assert.ok(draft.faqs.length);
    assert.ok(draft.metaTitle.length <= 60); assert.ok(draft.metaDescription.length <= 160);
  }
  const escaped = starterBlogDraft('Study <script>alert("x")</script>', [{ name: 'College <img src=x>', city: "Bhubaneswar", state: "Odisha", websiteUrl: "javascript:alert(1)" }]);
  assert.ok(!escaped.contentHtml.includes("<script>")); assert.ok(!escaped.contentHtml.includes("<img")); assert.ok(!escaped.contentHtml.includes("javascript:"));
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET; assert.ok(secret);
  const user = await db.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN", isActive: true } });
  const token = await encode({ token: { id: user.id, sub: user.id, email: user.email, role: "SUPER_ADMIN" }, secret, salt: "authjs.session-token", maxAge: 120 });
  const endpoint = "http://localhost:3000/api/v1/cms/blogs/generate";
  const post = (body: object, authenticated = true) => fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", ...(authenticated ? { Cookie: `authjs.session-token=${token}` } : {}) }, body: JSON.stringify(body) });
  assert.equal((await post({ title: "Admission guide" }, false)).status, 403);
  assert.equal((await post({ title: "a" })).status, 400);
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes("mock")) {
    const title = "Engineering admission guide for applicants";
    const before = await db.blogPost.count();
    const response = await post({ title }); const data = await response.json();
    assert.equal(response.status, 200, data.error); assert.equal(data.mode, "starter"); assert.ok(BlogDraftSchema.safeParse(data.draft).success); assert.ok(data.message.includes("OPENAI_API_KEY"));
    assert.equal(await db.blogPost.count(), before, "Generating a draft does not save or publish it");
  }
  console.log("Title drafts passed: full starter articles, metadata/tags/FAQs, title escaping, authorization, validation, configuration message and no automatic saving.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
