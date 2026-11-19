import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createCollegeProfile } from "../src/lib/create-college-profile";
import { CollegeCreateSchema } from "../src/lib/college-validation";
import { getCollegeBlogPosts } from "../src/lib/college-blogs";
const db = new PrismaClient();
const marker = `qa-initial-blog-${randomUUID()}`;
async function main() {
  const article = { title: "Separate college guide", contentMdx: "<p>Verified college article content written in the add-college form.</p>", category: "COLLEGE_ROUNDUP", publish: true };
  const base = { name: marker, slug: marker, city: "Bhubaneswar", state: "Odisha", isPublished: true, initialBlog: article };
  assert.equal(CollegeCreateSchema.safeParse({ ...base, initialBlog: { ...article, title: "" } }).success, false);
  assert.equal(CollegeCreateSchema.safeParse({ ...base, initialBlog: { ...article, contentMdx: "<p></p>" } }).success, false);
  try {
    await db.$transaction(async tx => {
      const admin = await tx.user.create({ data: { name: marker, email: `${marker}@example.com`, role: "SUPER_ADMIN" } });
      const staff = await tx.user.create({ data: { name: `${marker} staff`, email: `${marker}-staff@example.com`, role: "STAFF" } });
      const college = await createCollegeProfile(tx, base, admin.id);
      const posts = await getCollegeBlogPosts(college, undefined, tx);
      assert.equal(posts.length, 1); assert.equal(posts[0].title, article.title);
      assert.equal(posts[0].relatedCollegeId, college.id); assert.equal(posts[0].authorId, admin.id);
      assert.equal(posts[0].contentMdx, article.contentMdx); assert.equal(posts[0].status, "PUBLISHED");
      assert.ok(posts[0].publishedAt); assert.ok(posts[0].slug.length <= 80);
      const draftCollege = await createCollegeProfile(tx, { ...base, slug: `${marker}-draft`, isPublished: false }, admin.id);
      const draft = await tx.blogPost.findFirstOrThrow({ where: { relatedCollegeId: draftCollege.id } });
      assert.equal(draft.status, "DRAFT"); assert.equal(draft.publishedAt, null);
      assert.equal((await getCollegeBlogPosts(draftCollege, undefined, tx)).length, 0);
      const approvedCollege = await createCollegeProfile(tx, { ...base, slug: `${marker}-staff` }, admin.id, staff.id);
      const approved = await tx.blogPost.findFirstOrThrow({ where: { relatedCollegeId: approvedCollege.id } });
      assert.equal(approved.authorId, staff.id, "Keep the submitting staff member as author after administrator approval");
      const defaultDraft = await createCollegeProfile(tx, { ...base, slug: `${marker}-saved`, initialBlog: { ...article, publish: false } }, admin.id);
      assert.equal((await tx.blogPost.findFirstOrThrow({ where: { relatedCollegeId: defaultDraft.id } })).status, "DRAFT");
      throw Error("VERIFY_ROLLBACK");
    }, { timeout: 30000 });
  } catch (error) { if (!(error instanceof Error) || error.message !== "VERIFY_ROLLBACK") throw error; }
  assert.equal(await db.college.count({ where: { slug: { startsWith: marker } } }), 0);
  assert.equal(await db.blogPost.count({ where: { contentMdx: article.contentMdx } }), 0);
  console.log("Initial college blog passed: direct writing, separate article storage, correct college/author link, publication choices, draft protection, validation, and rollback.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
