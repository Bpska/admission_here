import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import source from "../src/data/college-imports/gift.json";
import { createCollegeProfile } from "../src/lib/create-college-profile";
import { slugifyCollegeName } from "../src/lib/college-slug";
const db = new PrismaClient();
const names: Record<string, string> = { "B.Tech": "Bachelor of Technology", "M.Tech": "Master of Technology", MCA: "Master of Computer Applications", MBA: "Master of Business Administration", BBA: "Bachelor of Business Administration", BCA: "Bachelor of Computer Applications", "M.Sc.": "Master of Science", Diploma: "Diploma in Engineering", "Ph.D.": "Doctor of Philosophy" };
async function main() {
  const directory = process.argv[2];
  if (!directory) throw Error("Pass the directory containing reviewed official images.");
  const assets = source.images.map(image => {
    const bytes = fs.readFileSync(path.join(directory, image.file));
    if (!bytes.length || bytes.length > 3 * 1024 * 1024) throw Error(`Invalid image size: ${image.file}`);
    const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!png && !jpeg) throw Error(`Invalid image type: ${image.file}`);
    return { ...image, bytes, mimeType: png ? "image/png" : "image/jpeg" };
  });
  const result = await db.$transaction(async tx => {
    const existing = await tx.college.findFirst({ where: { OR: [{ slug: source.college.slug }, { websiteUrl: source.college.websiteUrl }] }, select: { id: true, slug: true } });
    if (existing) return { unchanged: true, ...existing };
    const admin = await tx.user.findFirst({ where: { role: "SUPER_ADMIN", isActive: true }, select: { id: true } });
    if (!admin) throw Error("An active administrator is required as the compiled guide's author.");
    let logoUrl: string | null = null, coverImageUrl: string | null = null;
    const galleryUrls: string[] = [];
    const imageProvenance: { url: string; source: string }[] = [];
    for (const asset of assets) {
      const image = await tx.blogImage.create({ data: { data: asset.bytes, size: asset.bytes.length, mimeType: asset.mimeType, uploaderId: admin.id } });
      const url = `/api/v1/blog-images/${image.id}`;
      imageProvenance.push({ url, source: asset.source });
      if (asset.usage === "logo") logoUrl = url;
      else galleryUrls.push(url);
      if (asset.usage === "cover-gallery") coverImageUrl = url;
    }
    const college = await createCollegeProfile(tx, { ...source.college, logoUrl, coverImageUrl, galleryUrls, initialBlog: { ...source.initialBlog, featuredImageUrl: coverImageUrl } }, admin.id);
    for (const row of source.offerings) {
      const { degree, durationYrs, stream, level, ...offering } = row;
      const data = { degree, durationYrs, stream, level, fullName: names[degree] };
      let course = await tx.course.findFirst({ where: data });
      if (!course) {
        const digest = createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 10);
        const slug = `gift-${slugifyCollegeName(degree)}-${digest}`;
        course = await tx.course.upsert({ where: { slug }, create: { ...data, slug }, update: {} });
      }
      await tx.collegeCourse.create({ data: { ...offering, courseId: course.id, collegeId: college.id } });
    }
    for (const row of source.placements) await tx.placementStat.create({ data: { ...row, collegeId: college.id } });
    const blog = await tx.blogPost.findFirstOrThrow({ where: { relatedCollegeId: college.id }, select: { id: true, slug: true } });
    return { id: college.id, slug: college.slug, published: college.isPublished, courses: source.offerings.length, placementCohorts: source.placements.length, galleryPhotos: galleryUrls.length, faqs: source.college.faqsJson.length, blog, images: imageProvenance, reviewedAt: source.verifiedAt, unavailable: ["Verified NIRF rank", "Round-wise cutoffs", "Independent student reviews", "Complete-course tuition", "Highest/average packages"] };
  }, { timeout: 60000 });
  if (!("unchanged" in result)) {
    const audit = path.resolve("audit/2026-11-17"); fs.mkdirSync(audit, { recursive: true });
    fs.writeFileSync(path.join(audit, "gift-import.json"), JSON.stringify(result, null, 2) + "\n");
  }
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
