import { PrismaClient } from "@prisma/client";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import data from "../src/data/college-imports/odisha-eight.json";
import { createCollegeProfile } from "../src/lib/create-college-profile";
import { applyDataMutation, parseDataMutation } from "../src/lib/admin-data";
const db = new PrismaClient();
const degreeNames: Record<string, string> = { "B.Tech": "Bachelor of Technology", "M.Tech": "Master of Technology", MCA: "Master of Computer Applications", BCA: "Bachelor of Computer Applications", MBA: "Master of Business Administration", BBA: "Bachelor of Business Administration", "M.Sc": "Master of Science", "B.Sc": "Bachelor of Science", "B.Arch": "Bachelor of Architecture", "B.Plan": "Bachelor of Planning", Diploma: "Diploma", "D.Pharm": "Diploma in Pharmacy", "B.Pharm": "Bachelor of Pharmacy", MA: "Master of Arts", BHMCT: "Bachelor of Hotel Management and Catering Technology", MTH: "Master of Tourism and Hospitality", "Integrated MBA": "Integrated Master of Business Administration" };
function escape(text: string) { return text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }
function host(url?: string | null) { try { return new URL(url || "").hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } }
async function main() {
  const directory = process.argv[2];
  if (!directory) throw Error("Provide the directory with reviewed official images.");
  const sources = await Promise.all(data.colleges.map(async source => ({ ...source, images: await Promise.all(source.images.map(async image => {
    const bytes = await readFile(path.join(directory, path.basename(image.file)));
    const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])); const jpeg = bytes[0] === 255 && bytes[1] === 216; const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if (!bytes.length || bytes.length > 3 * 1024 * 1024 || !(png || jpeg || webp)) throw Error(`Invalid image: ${image.file}`);
    return { ...image, bytes, mimeType: png ? "image/png" : jpeg ? "image/jpeg" : "image/webp", sha256: createHash("sha256").update(bytes).digest("hex") };
  })) })));
  const results = await db.$transaction(async tx => {
    const admin = await tx.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN", isActive: true } });
    const existingColleges = await tx.college.findMany({ select: { id: true, name: true, slug: true, websiteUrl: true } });
    const results = [];
    for (const source of sources) {
      const existing = existingColleges.find(college => college.slug === source.slug || college.name.toLowerCase() === source.name.toLowerCase() || host(college.websiteUrl) === host(source.websiteUrl));
      if (existing) { results.push({ key: source.key, ...existing, created: false }); continue; }
      let logoUrl: string | null = null, coverImageUrl: string | null = null;
      const galleryUrls: string[] = [];
      const imageSources = [];
      for (const image of source.images) {
        const stored = await tx.blogImage.create({ data: { data: image.bytes, size: image.bytes.length, mimeType: image.mimeType, uploaderId: admin.id } });
        const url = `/api/v1/blog-images/${stored.id}`;
        if (image.usage === "logo") logoUrl = url;
        else { coverImageUrl ||= url; galleryUrls.push(url); }
        imageSources.push({ url, source: image.source, sha256: image.sha256 });
      }
      const sourceLinks = source.sources.map((url, index) => `<a href="${escape(url)}" target="_blank" rel="noreferrer">Official source ${index + 1}</a>`).join(" · ");
      const programmeNames = [...new Set(source.offerings.map(offering => offering.degree))];
      const college = await createCollegeProfile(tx, { name: source.name, slug: source.slug, shortName: source.shortName, websiteUrl: source.websiteUrl, city: source.city, state: source.state, ownershipType: source.ownershipType, estYear: source.estYear ?? null, fullAddress: source.fullAddress ?? null, pincode: source.pincode ?? null, contactPhone: source.contactPhone ?? null, contactEmail: source.contactEmail ?? null, naacGrade: source.naacGrade ?? null, approvedBy: source.approvedBy || [], campusAreaAcres: source.campusAreaAcres ?? null, nirfRank: null, logoUrl, coverImageUrl, galleryUrls, facilitiesJson: [], overviewHtml: `<p>${escape(source.summary)}</p><p>Programme families listed in this profile: ${programmeNames.map(escape).join(", ")}.</p><p>Institution and programme information checked on ${data.verifiedAt} using the official sources below.</p><p>${sourceLinks}</p>`, admissionHtml: `<p>Programme admission notices, eligibility requirements and application routes are published on the institution's official website. Use the notice for your selected course and admission year.</p><p><a href="${escape(source.admissionSource)}" target="_blank" rel="noreferrer">Official admission information</a></p>`, metaTitle: `${source.shortName}: Courses, Admissions & College Profile`, metaDescription: `Explore ${source.shortName}, ${source.city}: courses, programme-specific pages, admissions and official contact details.`, isPublished: true, showInNavbar: false }, admin.id);
      for (const offering of source.offerings) {
        const record = parseDataMutation("offerings", "create", { courseName: degreeNames[offering.degree] || offering.degree, degree: offering.degree, stream: offering.stream, level: offering.level, durationYrs: offering.durationYrs, specialization: offering.specialization, totalFeesInr: null, publishedFeeInr: null, firstYearFeesInr: null, hostelFeesYearlyInr: null, acceptedExamSlugs: offering.acceptedExamSlugs, programOverviewHtml: `<p>${escape(offering.specialization)} appears in the institution's official programme or curriculum directory.</p><p><a href="${escape(offering.source)}" target="_blank" rel="noreferrer">Official programme information</a></p>`, programAdmissionHtml: `<p>Check the official notice for current eligibility, entrance examinations, seat availability and application dates for ${escape(offering.degree)}.</p><p><a href="${escape(source.admissionSource)}" target="_blank" rel="noreferrer">Official admission information</a></p>` });
        await applyDataMutation(tx, { resource: "offerings", operation: "create", collegeId: college.id, data: record }, admin.id);
      }
      for (const ranking of source.rankings || []) await applyDataMutation(tx, { resource: "rankings", operation: "create", collegeId: college.id, data: parseDataMutation("rankings", "create", ranking) }, admin.id);
      results.push({ key: source.key, id: college.id, slug: college.slug, name: college.name, created: true, programmeCount: source.offerings.length, imageSources, sources: source.sources, verifiedAt: data.verifiedAt });
    }
    return results;
  }, { timeout: 60000 });
  await mkdir("audit/2026-11-19", { recursive: true });
  const auditPath = "audit/2026-11-19/odisha-eight-import.json";
  let history: unknown[] = []; try { history = JSON.parse(await readFile(auditPath, "utf8")).runs || []; } catch {}
  await writeFile(auditPath, JSON.stringify({ runs: [...history, { runAt: new Date().toISOString(), colleges: results }] }, null, 2) + "\n");
  console.log(JSON.stringify(results.map(result => ({ name: result.name, slug: result.slug, created: result.created, programmeCount: "programmeCount" in result ? result.programmeCount : undefined })), null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
