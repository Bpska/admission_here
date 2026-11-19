import { randomUUID } from "node:crypto";
import { slugifyCollegeName } from "./college-slug";
import { validateCustomNavbarFilter } from "./custom-navbar-filters";
import { Prisma } from "@prisma/client";
import { CollegeCreateSchema } from "./college-validation";
import { applyDataMutation } from "./admin-data";

export async function createCollegeProfile(tx: Prisma.TransactionClient, input: unknown, actorId: string, blogAuthorId = actorId) {
  const { onboardingData, initialBlog, ...profile } = CollegeCreateSchema.parse(input);
  await validateCustomNavbarFilter(tx, profile);
  const college = await tx.college.create({ data: profile });
  if (initialBlog) {
    if (initialBlog.featuredImageUrl) {
      const imageId = initialBlog.featuredImageUrl.split("/").pop()!;
      const image = await tx.blogImage.findUnique({ where: { id: imageId }, select: { uploaderId: true } });
      if (!image || (image.uploaderId !== blogAuthorId && image.uploaderId !== actorId)) throw new Error("Upload the college blog cover again using your account.");
    }
    const publish = initialBlog.publish && college.isPublished;
    const slug = `${slugifyCollegeName(`${college.slug}-${initialBlog.title}`).slice(0, 65).replace(/-+$/, "")}-${randomUUID().slice(0, 8)}`;
    await tx.blogPost.create({ data: {
      slug, title: initialBlog.title, contentMdx: initialBlog.contentMdx,
      showOnWebsiteBlog: initialBlog.showOnWebsiteBlog, category: initialBlog.category, featuredImageUrl: initialBlog.featuredImageUrl || null,
      metaDescription: initialBlog.metaDescription || null, relatedCollegeId: college.id,
      authorId: blogAuthorId, status: publish ? "PUBLISHED" : "DRAFT", publishedAt: publish ? new Date() : null,
    } });
  }
  if (!onboardingData) return college;
  const references = new Map<string, string>();
  for (const { clientId, ...data } of onboardingData.offerings) {
    const offering = await applyDataMutation(tx, { resource: "offerings", operation: "create", collegeId: college.id, data }, actorId);
    references.set(clientId, offering.id);
  }
  for (const data of onboardingData.cutoffs) {
    await applyDataMutation(tx, { resource: "cutoffs", operation: "create", collegeId: college.id, data: { ...data, collegeCourseId: references.get(data.collegeCourseId) } }, actorId);
  }
  for (const resource of ["placements", "rankings"] as const) {
    for (const data of onboardingData[resource]) await applyDataMutation(tx, { resource, operation: "create", collegeId: college.id, data }, actorId);
  }
  return college;
}
