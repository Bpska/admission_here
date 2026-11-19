import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PrismaClient } from "@prisma/client";
import { canonicalBlogHref, validateBlogDestination } from "../src/lib/blog-destination";
import { getCollegeBlogPosts } from "../src/lib/college-blogs";
import { CollegeBlogsContent } from "../src/components/college/CollegeBlogsContent";
const db = new PrismaClient();
const marker = `qa-college-blogs-${randomUUID()}`;
async function main() {
  try {
    await db.$transaction(async tx => {
      const author = await tx.user.create({ data: { name: marker, email: `${marker}@example.com`, role: "AUTHOR" } });
      const base = { city: "Bhubaneswar", state: "Odisha", ownershipType: "PRIVATE" as const, overviewHtml: "Verification", isPublished: true };
      const first = await tx.college.create({ data: { ...base, name: marker, slug: marker } });
      const second = await tx.college.create({ data: { ...base, name: `${marker} other`, slug: `${marker}-other` } });
      const makePost = (suffix: string, contentMdx: string, relatedCollegeId?: string, status: "PUBLISHED" | "DRAFT" = "PUBLISHED") => tx.blogPost.create({ data: { showOnWebsiteBlog: false, title: `${marker} ${suffix}`, slug: `${marker}-${suffix}`, authorId: author.id, category: "CAREER_GUIDE", contentMdx, relatedCollegeId, status, publishedAt: status === "PUBLISHED" ? new Date() : null } });
      const legacy = await makePost("legacy", "Original directly assigned article", first.id);
      const multi = await makePost("multi", `<p>Guide</p><EmbeddedCollegeCTA slug="${first.slug}" /><EmbeddedCollegeCTA slug="${second.slug}" />`);
      const rich = await makePost("rich", `<p>Guide</p><div data-blog-block="college" data-college-slug="${first.slug}">College card</div>`);
      await makePost("plain", `Ordinary text mentions ${first.slug} without a college link`);
      await makePost("prefix", `<EmbeddedCollegeCTA slug="${second.slug}" />`);
      const draft = await makePost("draft", "Private draft", first.id, "DRAFT");
      const website = await tx.blogPost.create({ data: { title: marker, slug: `${marker}-website`, authorId: author.id, category: "CAREER_GUIDE", contentMdx: "Website article", relatedCollegeId: first.id, status: "PUBLISHED", showOnWebsiteBlog: true } });
      assert.equal(await canonicalBlogHref(website, tx), `/blog/${website.slug}`);
      assert.equal(await canonicalBlogHref(legacy, tx), `/college/${first.slug}/blogs/${legacy.slug}`);
      assert.ok(await validateBlogDestination({ showOnWebsiteBlog: false, contentMdx: "No college" }, true, tx));
      assert.equal(await validateBlogDestination(legacy, true, tx), null);
      assert.equal(await validateBlogDestination({ showOnWebsiteBlog: true, contentMdx: "No college" }, true, tx), null);
      const results = await getCollegeBlogPosts(first, undefined, tx);
      assert.deepEqual(new Set(results.map(row => row.id)), new Set([legacy.id, multi.id, rich.id]));
      assert.equal((await getCollegeBlogPosts(second, undefined, tx)).length, 2);
      assert.equal((await getCollegeBlogPosts(first, { authorId: randomUUID() }, tx)).length, 0);
      const admin = await getCollegeBlogPosts(first, { authorId: author.id }, tx);
      assert.ok(admin.some(row => row.id === draft.id));
      const html = renderToStaticMarkup(<CollegeBlogsContent collegeName={first.name} collegeSlug={first.slug} posts={results} />);
      assert.ok(html.includes("Blogs &amp; News")); assert.ok(html.includes(`/college/${first.slug}/blogs/${multi.slug}`)); assert.ok(!html.includes(draft.title));
      const empty = renderToStaticMarkup(<CollegeBlogsContent collegeName="Empty college" posts={[]} />);
      assert.ok(empty.includes("No blog articles have been published"));
      await tx.blogPost.update({ where: { id: multi.id }, data: { contentMdx: `<EmbeddedCollegeCTA slug="${second.slug}" />` } });
      assert.equal((await getCollegeBlogPosts(first, undefined, tx)).length, 2, "Removing a college link updates its article list");
      await tx.blogPost.update({ where: { id: rich.id }, data: { status: "DRAFT" } });
      assert.equal((await getCollegeBlogPosts(first, undefined, tx)).length, 1, "Unpublished articles disappear from the public tab");
      throw Error("VERIFY_ROLLBACK");
    }, { timeout: 30000 });
  } catch (error) { if (!(error instanceof Error) || error.message !== "VERIFY_ROLLBACK") throw error; }
  assert.equal(await db.college.count({ where: { slug: { startsWith: marker } } }), 0);
  assert.equal(await db.blogPost.count({ where: { slug: { startsWith: marker } } }), 0);
  console.log("College blogs passed: legacy and multiple-college links, rich text links, exact membership, draft/author scoping, card rendering, empty state, unlinking and unpublishing. All test data rolled back.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
