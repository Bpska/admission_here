import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import { BlogCategory, Prisma } from "@prisma/client";
import { CollegeCreateSchema } from "../college-validation";
import { DATA_SCHEMAS } from "../admin-data";
import { slugifyCollegeName } from "../college-slug";
import { IMPORT_FIELDS, REMOVED_COLLEGE_FIELDS, normalize } from "./fields";

export function importBlogCategory(value: string) {
  const normalized = normalize(value);
  const existing = Object.values(BlogCategory).find(
    (category) => normalize(category) === normalized,
  );
  if (existing) return existing;
  const aliases: Record<string, BlogCategory> = {
    collegeguide: BlogCategory.COLLEGE_ROUNDUP,
    collegeguides: BlogCategory.COLLEGE_ROUNDUP,
    collegeroundup: BlogCategory.COLLEGE_ROUNDUP,
    careeradvice: BlogCategory.CAREER_GUIDE,
    admissionnews: BlogCategory.ADMISSION_ALERT,
    examupdates: BlogCategory.EXAM_NEWS,
  };
  return aliases[normalized] || value;
}

export type Decision = {
  action: "skip" | "update" | "create";
  targetId?: string;
  confirmed?: boolean;
  clearFields?: string[];
};
export type ImportOptions = {
  allowUpdates: boolean;
  allowPublish: boolean;
  publishOnImport?: boolean;
};
export type Catalog = Awaited<ReturnType<typeof loadCatalog>>;
export const DecisionSchema = z
  .object({
    action: z.enum(["skip", "update", "create"]),
    targetId: z.string().uuid().optional(),
    confirmed: z.boolean().optional(),
    clearFields: z.array(z.string()).max(50).optional(),
  })
  .strict();
export const OptionsSchema = z
  .object({
    allowUpdates: z.boolean().default(false),
    allowPublish: z.boolean().default(false),
    publishOnImport: z.boolean().default(false),
  })
  .strict();
export async function loadCatalog(tx: Prisma.TransactionClient) {
  const [colleges, exams] = await Promise.all([
    tx.college.findMany({
      include: { courses: { include: { course: true } } },
    }),
    tx.exam.findMany({ select: { id: true, name: true, slug: true } }),
  ]);
  return { colleges, exams };
}
export function host(value: string | null | undefined) {
  try {
    return new URL(value || "").hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}
export function findDuplicates(
  values: Record<string, string>,
  catalog: Catalog,
) {
  const name = normalize(values.name || ""),
    city = normalize(values.city || ""),
    state = normalize(values.state || ""),
    domain = host(values.websiteUrl);
  return catalog.colleges.flatMap((c) => {
    const sameName = !!name && normalize(c.name) === name,
      location =
        !!city &&
        !!state &&
        normalize(c.city) === city &&
        normalize(c.state) === state;
    const sameHost = !!domain && host(c.websiteUrl) === domain,
      sameSlug = !!values.slug && values.slug === c.slug;
    const words = (text: string) =>
      " " +
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim() +
      " ";
    const similar =
      !!name &&
      name.length > 8 &&
      location &&
      (words(c.name).includes(words(values.name || "")) ||
        words(values.name || "").includes(words(c.name)));
    if (!sameName && !sameHost && !sameSlug && !similar) return [];
    return [
      {
        id: c.id,
        name: c.name,
        city: c.city,
        state: c.state,
        websiteUrl: c.websiteUrl,
        confidence:
          (location && (sameName || sameHost)) || sameSlug
            ? "strong"
            : "uncertain",
        reason: [
          sameName && "same name",
          sameHost && "same website",
          sameSlug && "same URL slug",
          location && "same city/state",
          similar && !sameName && "similar name",
        ]
          .filter(Boolean)
          .join(", "),
      },
    ];
  });
}
export function mapValues(raw: string[], mapping: Record<string, string>) {
  const data: Record<string, string> = {};
  for (const [index, key] of Object.entries(mapping))
    if (key && !REMOVED_COLLEGE_FIELDS.has(key))
      data[key] = raw[Number(index)] || "";
  return data;
}
function list(value: string) {
  if (value.trim().startsWith("[")) {
    const a = JSON.parse(value);
    return z.array(z.string().trim().min(1)).max(100).parse(a);
  }
  return value
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}
export function safeHtml(value: string) {
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(value);
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return sanitizeHtml(
    isHtml
      ? value
      : escaped
          .split(/\n\s*\n/)
          .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
          .join(""),
    {
      allowedTags: [
        "p",
        "br",
        "b",
        "strong",
        "em",
        "i",
        "u",
        "h2",
        "h3",
        "h4",
        "ul",
        "ol",
        "li",
        "a",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "blockquote",
      ],
      allowedAttributes: { a: ["href", "rel", "target"] },
      allowedSchemes: ["https", "http", "mailto"],
      allowProtocolRelative: false,
    },
  );
}
function contentSection(
  base: string,
  key: string,
  title: string,
  content: string,
) {
  const start = `<!--bulk-${key}-->`,
    end = `<!--/bulk-${key}-->`;
  return (
    base.replace(new RegExp(`${start}[\\s\\S]*?${end}`, "g"), "") +
    start +
    `<h3>${title}</h3>` +
    content +
    end
  );
}
function safeUrl(value: string, image = false) {
  if (image && /^\/api\/v1\/blog-images\/[a-f0-9-]{36}$/i.test(value))
    return value;
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Use an HTTP(S) URL without embedded credentials.");
  return url.toString();
}
function number(value: string) {
  if (!/^\d+(\.\d+)?$/.test(value.trim()))
    throw new Error(
      "Enter a plain non-negative number; amounts must be in INR without commas or currency symbols.",
    );
  const n = Number(value);
  if (!Number.isSafeInteger(n) && !value.includes("."))
    throw new Error("Number is too large.");
  return n;
}
function boolean(value: string) {
  if (/^(yes|true|published|1)$/i.test(value)) return true;
  if (/^(no|false|draft|0)$/i.test(value)) return false;
  throw new Error("Use Yes/No or Draft/Published.");
}
function jsonArray(value: string, label: string) {
  let data;
  try {
    data = JSON.parse(value, (key, value) => {
      if (["__proto__", "constructor", "prototype"].includes(key))
        throw new Error("Unsafe JSON key.");
      return value;
    });
  } catch {
    throw new Error(
      `${label}: malformed JSON. Use double quotes and a JSON array.`,
    );
  }
  return z.array(z.record(z.unknown())).max(100).parse(data);
}
function errorsOf(error: unknown) {
  return error instanceof z.ZodError
    ? error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    : error instanceof Error
      ? error.message
      : "Invalid value.";
}
export function programmeKey(degree: string, specialization: string) {
  return `${normalize(degree)}:${normalize(specialization)}`;
}
const aliases: Record<string, string> = {
  programmeName: "courseName",
  programName: "courseName",
  name: "courseName",
  duration: "durationYrs",
  category: "level",
  eligibility: "eligibilityDescription",
  tuitionFee: "firstYearFeesInr",
  totalFee: "totalFeesInr",
  entranceExams: "acceptedExamSlugs",
  availableSeats: "intakeSeats",
  overview: "programOverviewHtml",
  admission: "programAdmissionHtml",
  placements: "programPlacementHtml",
};
export function normalizeProgramme(input: Record<string, unknown>) {
  const item: Record<string, any> = {};
  for (const [k, v] of Object.entries(input)) {
    const key = aliases[k] || k;
    if (key in item)
      throw new Error(`Programme field ${key} was supplied twice.`);
    item[key] = v;
  }
  const suppliedCourseName =
    typeof item.courseName === "string" && Boolean(item.courseName.trim());
  if (!item.courseName) delete item.courseName;
  const ref = z
    .string()
    .trim()
    .min(1)
    .max(100)
    .parse(
      item.ref ||
        `${item.degree || item.courseName || ""}: ${item.specialization || "General"}`,
    );
  delete item.ref;
  if ("courseId" in item || "id" in item)
    throw new Error(
      "Do not supply internal course IDs. Use programme ref, degree and specialization.",
    );
  const known: Record<string, [string, string, string]> = {
    btech: ["B.Tech", "Engineering", "UG"],
    be: ["B.E.", "Engineering", "UG"],
    mtech: ["M.Tech", "Engineering", "PG"],
    mba: ["MBA", "Management", "PG"],
    bba: ["BBA", "Management", "UG"],
    mca: ["MCA", "Computer Applications", "PG"],
    bca: ["BCA", "Computer Applications", "UG"],
    diploma: ["Diploma", "Diploma", "Diploma"],
  };
  const info = known[normalize(String(item.degree || ""))];
  if (info) {
    item.degree = info[0];
    if (
      item.stream &&
      normalize(item.stream) !== normalize(info[1]) &&
      item.degree !== "Diploma"
    )
      throw new Error(`${item.degree} must use the ${info[1]} stream.`);
    item.stream = item.stream || info[1];
    item.level ||= info[2];
  }
  item.courseName ??= item.degree;
  item.specialization ??= "General";
  for (const key of Object.keys(item))
    if (item[key] === "" || item[key] === null) delete item[key];
  for (const key of [
    "programOverviewHtml",
    "programAdmissionHtml",
    "programPlacementHtml",
  ])
    if (item[key]) item[key] = safeHtml(String(item[key]));
  for (const key of ["feeSourceUrl", "syllabusPdfUrl"])
    if (item[key]) item[key] = safeUrl(item[key]);
  if (item.acceptedExamSlugs && typeof item.acceptedExamSlugs === "string")
    item.acceptedExamSlugs = list(item.acceptedExamSlugs);
  const result = DATA_SCHEMAS.offerings.strict().parse(item);
  if (!result.courseName || !result.degree || !result.stream || !result.level)
    throw new Error(
      "Each programme requires courseName, degree, stream and level.",
    );
  return { ref, suppliedCourseName, ...result };
}
export type Plan = Awaited<ReturnType<typeof validateRow>>;
export async function validateRow(
  raw: string[],
  mapping: Record<string, string>,
  decision: Decision | undefined,
  options: ImportOptions,
  catalog: Catalog,
) {
  const values = mapValues(raw, mapping),
    errors: string[] = [],
    warnings: string[] = [];
  const sample =
    /^sample$/i.test(values.sample || "") ||
    /^sample\s*[—-]/i.test(values.name || "");
  const candidates = findDuplicates(values, catalog);
  const choice: Decision = decision || {
    action: sample ? "skip" : candidates.length ? "skip" : "create",
  };
  const existing =
    choice.action === "update"
      ? catalog.colleges.find((c) => c.id === choice.targetId)
      : undefined;
  const profile: Record<string, any> = {},
    programmes: ReturnType<typeof normalizeProgramme>[] = [],
    cutoffs: any[] = [],
    placements: any[] = [],
    rankings: any[] = [];
  let blog: any;
  const check = (label: string, fn: () => void) => {
    try {
      fn();
    } catch (e) {
      errors.push(`${label}: ${errorsOf(e)}`);
    }
  };
  if (sample)
    return {
      name: values.name || "Sample row",
      sample: true,
      choice: { action: "skip" } as Decision,
      candidates,
      errors,
      warnings: ["Template sample row is always skipped."],
      profile,
      programmes,
      cutoffs,
      placements,
      rankings,
      blog,
      programmeAdds: 0,
      programmeUpdates: 0,
    };
  if (choice.action === "skip")
    return {
      name: values.name || "(unnamed)",
      sample: false,
      choice,
      candidates,
      errors,
      warnings: [
        "This row will be skipped. Choose Update or Create and validate to inspect its data.",
      ],
      profile,
      programmes,
      cutoffs,
      placements,
      rankings,
      blog,
      programmeAdds: 0,
      programmeUpdates: 0,
    };
  if (choice.action === "update") {
    if (!existing) errors.push("Select an existing college to update.");
    if (existing && !candidates.some((c) => c.id === existing.id))
      errors.push(
        "The selected college does not match this row. Correct the name, URL or location before updating.",
      );
    if (!options.allowUpdates)
      errors.push(
        "Explicitly allow updates to existing colleges before importing.",
      );
    if (!choice.confirmed)
      errors.push("Confirm the selected existing college before updating.");
  }
  if (choice.action === "create" && candidates.length && !choice.confirmed)
    errors.push(
      "Possible existing college found. Explicitly confirm Create New, or choose Update/Skip.",
    );
  const simple = [
    "name",
    "slug",
    "shortName",
    "affiliatedTo",
    "fullAddress",
    "city",
    "state",
    "pincode",
    "contactPhone",
    "naacGrade",
    "metaTitle",
    "metaDescription",
    "navbarCategory",
    "navbarSection",
    "navbarFilter",
  ];
  for (const key of simple) if (values[key]) profile[key] = values[key];
  if (values.university) {
    if (
      values.affiliatedTo &&
      normalize(values.university) !== normalize(values.affiliatedTo)
    )
      errors.push("University and Affiliation must match, or supply only one.");
    else profile.affiliatedTo = values.university;
  }
  for (const key of [
    "websiteUrl",
    "brochurePdfUrl",
    "logoUrl",
    "coverImageUrl",
  ])
    if (values[key])
      check(
        key,
        () => (profile[key] = safeUrl(values[key], /Image|logo/.test(key))),
      );
  if (values.contactEmail)
    check(
      "Email",
      () =>
        (profile.contactEmail = z.string().email().parse(values.contactEmail)),
    );
  for (const key of ["estYear", "nirfRank", "campusAreaAcres"])
    if (values[key])
      check(key, () => {
        const n = number(values[key]);
        if (key !== "campusAreaAcres" && !Number.isInteger(n))
          throw new Error("Use a whole number.");
        if (key === "estYear" && (n < 1000 || n > new Date().getFullYear() + 1))
          throw new Error("Use a valid establishment year.");
        if (key === "nirfRank" && n < 1)
          throw new Error("Rank must be at least 1.");
        profile[key] = n;
      });
  if (values.ownershipType) {
    const types: Record<string, string> = {
      government: "PUBLIC_GOVERNMENT",
      public: "PUBLIC_GOVERNMENT",
      private: "PRIVATE",
      deemed: "DEEMED",
      autonomous: "AUTONOMOUS",
    };
    profile.ownershipType =
      types[values.ownershipType.toLowerCase()] || values.ownershipType;
  }
  if (values.approvedBy)
    check("Approvals", () => (profile.approvedBy = list(values.approvedBy)));
  for (const key of [
    "overviewHtml",
    "admissionHtml",
    "hostelInfo",
    "scholarshipInfo",
  ])
    if (values[key]) profile[key] = safeHtml(values[key]);
  if (values.highlights)
    profile.overviewHtml = contentSection(
      profile.overviewHtml ?? existing?.overviewHtml ?? "",
      "highlights",
      "Highlights",
      safeHtml(values.highlights),
    );
  for (const [key, label] of [
    ["eligibility", "Eligibility"],
    ["importantDates", "Important dates"],
    ["admissionLink", "Admission link"],
  ])
    if (values[key])
      check(label, () => {
        const content =
          key === "admissionLink"
            ? `<p><a href="${safeUrl(values[key]).replace(/"/g, "&quot;")}">Official admission page</a></p>`
            : safeHtml(values[key]);
        profile.admissionHtml = contentSection(
          profile.admissionHtml ?? existing?.admissionHtml ?? "",
          key,
          label,
          content,
        );
      });
  let facilities: string[] =
    !values.facilities && Array.isArray(existing?.facilitiesJson)
      ? existing.facilitiesJson.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
  let facilitiesChanged = Boolean(values.facilities);
  if (values.facilities)
    check("Facilities", () => {
      facilities = list(values.facilities);
    });
  for (const [key, label] of [
    ["library", "Library"],
    ["laboratories", "Laboratories"],
    ["wifi", "Wi-Fi"],
    ["transport", "Transport"],
    ["sports", "Sports"],
    ["otherfacilities", "Other facilities"],
  ]) {
    if (!values[key]) continue;
    facilitiesChanged = true;
    facilities = facilities.filter(
      (value) => normalize(value.split(":")[0]) !== normalize(label),
    );
    facilities.push(`${label}: ${values[key]}`);
  }
  if (facilitiesChanged) profile.facilitiesJson = facilities;
  for (const key of ["faqsJson", "qnaJson"])
    if (values[key])
      check(
        key,
        () =>
          (profile[key] = z
            .array(
              z
                .object({
                  question: z.string().trim().min(1),
                  answer: z.string().trim().min(1),
                })
                .strict(),
            )
            .max(100)
            .parse(JSON.parse(values[key]))),
      );
  if (values.galleryUrls)
    check(
      "Gallery",
      () =>
        (profile.galleryUrls = list(values.galleryUrls).map((url) =>
          safeUrl(url, true),
        )),
    );
  for (const key of ["isPublished", "showInNavbar"])
    if (values[key]) check(key, () => (profile[key] = boolean(values[key])));
  if (options.publishOnImport) {
    if (!options.allowPublish)
      errors.push(
        "Enable publishing permission before choosing Publish when confirmed.",
      );
    else profile.isPublished = true;
  }
  if (existing?.isPublished && profile.isPublished === false)
    warnings.push(
      "This spreadsheet sets Publication Status to Draft and will hide this existing college from the public website. Leave the status cell blank to preserve its current publication.",
    );
  if (profile.isPublished === true && !options.allowPublish)
    errors.push(
      "Publishing requires explicit publication confirmation, or change Publication Status to Draft.",
    );
  const clearAllowed = new Set([
    "shortName",
    "affiliatedTo",
    "fullAddress",
    "pincode",
    "contactPhone",
    "naacGrade",
    "metaTitle",
    "metaDescription",
    "websiteUrl",
    "brochurePdfUrl",
    "logoUrl",
    "coverImageUrl",
    "contactEmail",
    "estYear",
    "nirfRank",
    "campusAreaAcres",
    "overviewHtml",
    "admissionHtml",
    "hostelInfo",
    "scholarshipInfo",
    "approvedBy",
    "galleryUrls",
    "faqsJson",
    "qnaJson",
    "facilitiesJson",
  ]);
  for (const key of choice.clearFields || []) {
    if (!existing || !clearAllowed.has(key))
      errors.push(
        `Cannot clear ${key}. Choose an optional college field on an existing college.`,
      );
    else
      profile[key] = ["approvedBy", "galleryUrls"].includes(key)
        ? []
        : ["faqsJson", "qnaJson", "facilitiesJson"].includes(key)
          ? []
          : ["overviewHtml"].includes(key)
            ? ""
            : null;
  }
  if (!existing) {
    profile.slug ||= slugifyCollegeName(
      `${values.name || ""}-${values.city || ""}`,
    );
    profile.overviewHtml ??= "";
    profile.isPublished ??= false;
    if (!profile.ownershipType)
      warnings.push(
        "College Type is blank; the existing form default PUBLIC_GOVERNMENT will be used. Confirm that this is correct.",
      );
  }
  check("College", () => {
    const validated = CollegeCreateSchema.parse({
      ...existing,
      faqsJson: existing?.faqsJson ?? undefined,
      ...profile,
      initialBlog: undefined,
      onboardingData: undefined,
    });
    if (!existing) Object.assign(profile, validated);
  });
  if (values.programmes)
    check("Programmes JSON", () => {
      const keys = new Set<string>(),
        refs = new Set<string>();
      for (const input of jsonArray(values.programmes, "Programmes")) {
        const item = normalizeProgramme(input),
          key = programmeKey(item.degree!, item.specialization);
        if (keys.has(key) || refs.has(item.ref))
          throw new Error(
            `Duplicate programme or ref: ${item.ref}. Combine it into one programme entry.`,
          );
        keys.add(key);
        refs.add(item.ref);
        programmes.push(item);
      }
    });
  const available = [
    ...programmes.map((p) => ({
      ref: p.ref,
      degree: p.degree!,
      specialization: p.specialization,
    })),
    ...(existing?.courses || [])
      .filter(
        (c) =>
          !programmes.some(
            (p) =>
              programmeKey(p.degree!, p.specialization) ===
              programmeKey(c.course.degree, c.specialization),
          ),
      )
      .map((c) => ({
        ref: `${c.course.degree}: ${c.specialization}`,
        degree: c.course.degree,
        specialization: c.specialization,
      })),
  ];
  const resolveProgramme = (value: unknown) => {
    const ref = String(value || "");
    const exact = available.filter((p) => normalize(p.ref) === normalize(ref));
    const matched = exact.length
      ? exact
      : available.filter((p) => normalize(p.degree) === normalize(ref));
    if (matched.length !== 1)
      throw new Error(
        `Programme '${ref}' is missing or ambiguous. Use a unique programme ref in Programmes JSON (or 'Degree: Specialization' for an existing programme).`,
      );
    return matched[0];
  };
  if (values.cutoffs)
    check("Cutoffs JSON", () => {
      const seen = new Set<string>();
      for (const input of jsonArray(values.cutoffs, "Cutoffs")) {
        const { programme, entranceExam, ...rest } = input;
        for (const key of Object.keys(rest))
          if (rest[key] === null || rest[key] === "") delete rest[key];
        const p = resolveProgramme(programme);
        const exam = catalog.exams.filter((e) =>
          [e.slug, e.name].some(
            (n) => normalize(n) === normalize(String(entranceExam || "")),
          ),
        );
        if (exam.length !== 1)
          throw new Error(
            `Entrance exam '${entranceExam}' must match an existing exam name or slug.`,
          );
        const data = DATA_SCHEMAS.cutoffs.strict().parse({
          ...rest,
          quota: rest.quota || "AI",
          gender: rest.gender || "Gender-Neutral",
          examId: exam[0].id,
          collegeCourseId: "00000000-0000-4000-8000-000000000001",
        });
        if (
          data.openingRank &&
          data.closingRank &&
          data.openingRank > data.closingRank
        )
          throw new Error("Opening rank must not exceed closing rank.");
        const key = [
          programmeKey(p.degree, p.specialization),
          data.examId,
          data.academicYear,
          data.counselingRound,
          data.category,
          data.quota,
          data.gender,
        ].join("|");
        if (seen.has(key)) throw new Error("Duplicate cutoff entry.");
        seen.add(key);
        cutoffs.push({
          ...data,
          programmeKey: programmeKey(p.degree, p.specialization),
        });
      }
    });
  if (values.placements)
    check("Placements JSON", () => {
      const seen = new Set<string>();
      for (const input of jsonArray(values.placements, "Placements")) {
        const { programme, ...rest } = input;
        for (const key of Object.keys(rest))
          if (rest[key] === null || rest[key] === "") delete rest[key];
        const p = programme ? resolveProgramme(programme) : undefined;
        // Import URLs are references only. Existing upload constraints remain unchanged.
        const { photoUrls, ...withoutPhotos } = rest;
        const data: any = DATA_SCHEMAS.placements
          .omit({ photoUrls: true })
          .strict()
          .parse(withoutPhotos);
        if (data.sourceUrl) data.sourceUrl = safeUrl(data.sourceUrl);
        if (photoUrls)
          data.photoUrls = z
            .array(z.string())
            .max(100)
            .parse(photoUrls)
            .map((url) => safeUrl(url, true));
        const key = `${p ? programmeKey(p.degree, p.specialization) : "overall"}:${data.batchYear}`;
        if (seen.has(key)) throw new Error("Duplicate placement cohort/year.");
        seen.add(key);
        placements.push({
          ...data,
          programmeKey: p
            ? programmeKey(p.degree, p.specialization)
            : undefined,
        });
      }
    });
  if (values.rankings)
    check("Rankings JSON", () => {
      const seen = new Set<string>();
      for (const input of jsonArray(values.rankings, "Rankings")) {
        const data = DATA_SCHEMAS.rankings
          .strict()
          .parse(
            Object.fromEntries(
              Object.entries(input).filter(([, v]) => v !== null && v !== ""),
            ),
          );
        const key = `${normalize(data.agencyName)}:${normalize(data.category)}:${data.rankingYear}`;
        if (seen.has(key)) throw new Error("Duplicate ranking entry.");
        seen.add(key);
        rankings.push(data);
      }
    });
  if (values.blogTitle || values.blogContent)
    check("College blog", () => {
      blog = z
        .object({
          title: z.string().trim().min(3).max(200),
          contentMdx: z.string().trim().min(10).max(100000),
          category: z.nativeEnum(BlogCategory),
          showOnWebsiteBlog: z.boolean(),
          publish: z.boolean(),
          featuredImageUrl: z.string().optional(),
          metaDescription: z.string().max(500).optional(),
        })
        .parse({
          title: values.blogTitle,
          contentMdx: safeHtml(values.blogContent || ""),
          category: importBlogCategory(
            values.blogCategory || "COLLEGE_ROUNDUP",
          ),
          showOnWebsiteBlog: values.blogWebsite
            ? boolean(values.blogWebsite)
            : false,
          publish: values.blogPublish ? boolean(values.blogPublish) : false,
          featuredImageUrl: values.blogImage
            ? safeUrl(values.blogImage, true)
            : undefined,
          metaDescription: values.blogDescription || undefined,
        });
      blog.suppliedCategory = Boolean(values.blogCategory);
      blog.suppliedWebsite = Boolean(values.blogWebsite);
      if (
        !values.blogContent?.trim() ||
        blog.contentMdx.replace(/<[^>]*>/g, "").trim().length < 10
      )
        throw new Error("Enter at least 10 characters of article text.");
      if (
        blog.publish &&
        (!options.allowPublish ||
          !(profile.isPublished ?? existing?.isPublished))
      )
        throw new Error(
          "Publishing a blog requires publication confirmation and a published college.",
        );
    });
  for (const programme of programmes)
    if (
      (existing?.courses.filter(
        (c) =>
          programmeKey(c.course.degree, c.specialization) ===
          programmeKey(programme.degree!, programme.specialization),
      ).length || 0) > 1
    )
      errors.push(
        `Existing programme ${programme.ref} has duplicate saved entries. Resolve those in the college editor before updating it.`,
      );
  const programmeUpdates = programmes.filter((p) =>
    existing?.courses.some(
      (c) =>
        programmeKey(c.course.degree, c.specialization) ===
        programmeKey(p.degree!, p.specialization),
    ),
  ).length;
  if (Object.values(values).some((v) => /^[=+@]/.test(v)))
    warnings.push(
      "Formula-like text was treated only as text; spreadsheet code is never executed.",
    );
  const unmapped = Object.entries(mapping).filter(([, v]) => !v).length;
  if (unmapped)
    warnings.push(
      `${unmapped} unmatched column(s) will be ignored. Map them or explicitly leave them ignored.`,
    );
  return {
    name: values.name || existing?.name || "(unnamed)",
    sample: false,
    choice,
    candidates,
    errors,
    warnings,
    profile,
    programmes,
    cutoffs,
    placements,
    rankings,
    blog,
    programmeAdds: programmes.length - programmeUpdates,
    programmeUpdates,
  };
}
export function validateMapping(
  mapping: Record<string, string>,
  headers: string[],
) {
  const allowed = new Set([
      ...IMPORT_FIELDS.map((f) => f.key),
      ...REMOVED_COLLEGE_FIELDS,
    ]),
    seen = new Set<string>();
  for (const [key, value] of Object.entries(mapping)) {
    if (
      !/^\d+$/.test(key) ||
      Number(key) >= headers.length ||
      (value && !allowed.has(value))
    )
      throw new Error("Invalid column mapping.");
    if (value && seen.has(value))
      throw new Error(
        `Multiple columns map to ${value}. Choose one or ignore the other.`,
      );
    if (value) seen.add(value);
  }
  if (!seen.has("name") && !seen.has("websiteUrl") && !seen.has("slug"))
    throw new Error(
      "Map at least College Name, Official Website or URL Slug to identify colleges.",
    );
}
