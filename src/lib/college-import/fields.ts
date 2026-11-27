import { COLLEGE_OWNERSHIP_LABELS } from "../college-ownership";

/** Public headings and aliases are shared by the parser, mapping UI and template. */
export type ImportField = {
  key: string;
  label: string;
  hint: string;
  aliases?: string[];
  choices?: string[];
};
const FIELD_CATALOG: ImportField[] = [
  {
    key: "sample",
    label: "Sample Row",
    hint: "SAMPLE rows are ignored. Clear this cell for a real college.",
  },
  {
    key: "name",
    label: "College Name",
    hint: "Required for new colleges. One row per institution.",
    aliases: ["name", "institution", "institute name"],
  },
  {
    key: "slug",
    label: "URL Slug",
    hint: "Optional. Generated from name and location; lowercase hyphen-separated URL name.",
  },
  { key: "shortName", label: "Short Name", hint: "Abbreviation." },
  {
    key: "ownershipType",
    label: "College Type",
    hint: "Choose the actual ownership value.",
    aliases: ["ownership", "ownership type"],
    choices: Object.keys(COLLEGE_OWNERSHIP_LABELS),
  },
  {
    key: "estYear",
    label: "Established Year",
    hint: "Four digit establishment year.",
    aliases: ["establishment year"],
  },
  {
    key: "affiliatedTo",
    label: "Affiliation",
    hint: "Affiliated university or board.",
    aliases: ["affiliated to"],
  },
  {
    key: "university",
    label: "University",
    hint: "Alias of affiliation. If both are supplied they must match.",
  },
  {
    key: "approvedBy",
    label: "Approvals",
    hint: "Comma-separated verified approvals.",
  },
  {
    key: "naacGrade",
    label: "Accreditation",
    hint: "NAAC grade, for example A++. Other approvals belong in Approvals.",
    aliases: ["naac grade"],
  },
  {
    key: "nirfRank",
    label: "NIRF Rank",
    hint: "Only a verified numeric ranking.",
  },
  { key: "state", label: "State", hint: "Required for new colleges." },
  { key: "city", label: "City", hint: "Required for new colleges." },
  {
    key: "fullAddress",
    label: "Full Address",
    hint: "Campus address.",
    aliases: ["address"],
  },
  {
    key: "pincode",
    label: "PIN Code",
    hint: "Keep as text to preserve leading zeros.",
  },
  {
    key: "websiteUrl",
    label: "Official Website",
    hint: "Public HTTPS or HTTP URL.",
    aliases: ["website", "website url"],
  },
  {
    key: "contactEmail",
    label: "Email",
    hint: "Admissions email.",
    aliases: ["contact email"],
  },
  {
    key: "contactPhone",
    label: "Phone",
    hint: "Keep as text.",
    aliases: ["contact phone", "mobile"],
  },
  {
    key: "campusAreaAcres",
    label: "Campus Area Acres",
    hint: "Numeric campus area in acres.",
  },
  {
    key: "overviewHtml",
    label: "College Overview",
    hint: "Normal text or safe formatted HTML.",
    aliases: ["overview"],
  },
  {
    key: "highlights",
    label: "College Highlights",
    hint: "Added to the overview under Highlights.",
  },
  {
    key: "admissionHtml",
    label: "Admission Procedure",
    hint: "Normal text or safe HTML.",
    aliases: ["admission"],
  },
  {
    key: "eligibility",
    label: "Admission Eligibility",
    hint: "College-level eligibility, added to admission content.",
  },
  {
    key: "importantDates",
    label: "Important Dates",
    hint: "Dates and academic year; added to admission content.",
  },
  {
    key: "admissionLink",
    label: "Admission Link",
    hint: "Official admission URL; added to admission content.",
  },
  {
    key: "brochurePdfUrl",
    label: "Official Brochure PDF URL",
    hint: "HTTP(S) brochure URL.",
    aliases: ["brochure url"],
  },
  {
    key: "facilities",
    label: "Facilities List",
    hint: "Comma-separated or one facility per line.",
    aliases: ["facilities"],
  },
  {
    key: "hostelInfo",
    label: "Hostel",
    hint: "Hostel and mess information.",
    aliases: ["hostel information"],
  },
  ...[
    "Library",
    "Laboratories",
    "Wi-Fi",
    "Transport",
    "Sports",
    "Other Facilities",
  ].map((label) => ({
    key: label.toLowerCase().replace(/[^a-z]/g, ""),
    label,
    hint: "Facility description, stored in the college facilities list.",
  })),
  {
    key: "scholarshipInfo",
    label: "Scholarships",
    hint: "Scholarship and concession details.",
  },
  {
    key: "programmes",
    label: "Programmes JSON",
    hint: "JSON array. Each item: courseName, degree, stream, level (UG/PG/Diploma/Doctoral), specialization; optional ref and all programme fields. See template comment.",
    aliases: ["programs json", "courses json"],
  },
  {
    key: "cutoffs",
    label: "Cutoffs JSON",
    hint: "JSON array: programme (ref or unambiguous degree), entranceExam (existing name/slug), academicYear, counselingRound, category, quota, gender, openingRank, closingRank, cutoffPercentile.",
  },
  {
    key: "placements",
    label: "Placements JSON",
    hint: "JSON array: batchYear, optional programme (ref/degree), highestPackageInr, averagePackageInr, medianPackageInr, placementPercentage, totalOffers, topRecruiters, sourceUrl, sourceNote, photoUrls. Amounts in INR.",
  },
  {
    key: "rankings",
    label: "Rankings JSON",
    hint: "JSON array: agencyName, category, rankingYear, rankNumber, outOfTotal.",
  },
  {
    key: "faqsJson",
    label: "FAQs JSON",
    hint: "JSON array of {question,answer}.",
    aliases: ["faqs", "questions and answers"],
  },
  {
    key: "qnaJson",
    label: "Q and A JSON",
    hint: "JSON array of {question,answer}.",
  },
  {
    key: "logoUrl",
    label: "Logo Image URL",
    hint: "Public HTTPS image URL or existing uploaded image path. Downloaded when confirmed.",
  },
  {
    key: "coverImageUrl",
    label: "Cover Image URL",
    hint: "Public HTTPS image URL or existing uploaded image path. Downloaded when confirmed.",
    aliases: ["image urls", "image url"],
  },
  {
    key: "galleryUrls",
    label: "Gallery Image URLs",
    hint: "Up to 10 public HTTPS image URLs or existing uploaded image paths. Use a JSON array or one URL per line.",
    aliases: ["gallery urls"],
  },
  {
    key: "blogTitle",
    label: "College Blog Title",
    hint: "Optional college-linked draft article title.",
  },
  {
    key: "blogContent",
    label: "College Blog Content",
    hint: "Article text; requires a blog title.",
  },
  {
    key: "blogCategory",
    label: "College Blog Category",
    hint: "Default COLLEGE_ROUNDUP.",
    choices: [
      "EXAM_NEWS",
      "ADMISSION_ALERT",
      "CUTOFF_ANALYSIS",
      "COLLEGE_ROUNDUP",
      "CAREER_GUIDE",
      "SCHOLARSHIP",
    ],
  },
  {
    key: "blogImage",
    label: "College Blog Image URL",
    hint: "HTTP(S) or existing uploaded image URL.",
  },
  {
    key: "blogDescription",
    label: "College Blog SEO Description",
    hint: "Optional article description.",
  },
  {
    key: "blogWebsite",
    label: "College Blog On Website",
    hint: "Yes to also list on the main blog; default No.",
    choices: ["Yes", "No"],
  },
  {
    key: "blogPublish",
    label: "College Blog Publish",
    hint: "Default No. Publishing requires a published college and explicit confirmation.",
    choices: ["Yes", "No"],
  },
  {
    key: "metaTitle",
    label: "SEO Title",
    hint: "College page metadata title.",
  },
  {
    key: "metaDescription",
    label: "SEO Description",
    hint: "College page metadata description.",
  },
  {
    key: "isPublished",
    label: "Publication Status",
    hint: "Used when Publish when confirmed is off. Otherwise the selected Create/Update rows publish after confirmation. Without that option, blank new status defaults to Draft and blank existing status is preserved.",
    choices: ["Draft", "Published"],
  },
  {
    key: "showInNavbar",
    label: "Include In Navbar",
    hint: "Yes / No. Visible only for published colleges.",
    choices: ["Yes", "No"],
  },
  {
    key: "navbarCategory",
    label: "Navbar Category",
    hint: "Existing navbar category.",
    choices: [
      "mba",
      "engineering",
      "medical",
      "design",
      "more",
      "study_abroad",
      "counseling",
    ],
  },
  {
    key: "navbarSection",
    label: "Navbar Section",
    hint: "Existing section identifier.",
    choices: ["featured", "column_1", "column_2", "column_3"],
  },
  {
    key: "navbarFilter",
    label: "Navbar Filter",
    hint: "Existing filter identifier; custom filters must first be created in the normal admin form.",
  },
];
export const MANUAL_IMPORT_FIELDS = new Set([
  "nirfRank",
  "cutoffs",
  "rankings",
]);
export const IMPORT_FIELDS = FIELD_CATALOG;
// Older previews can contain bare mappings for these previously ignored fields.
export function importMappingValue(key: string) {
  return MANUAL_IMPORT_FIELDS.has(key) ? `manual:${key}` : key;
}

export function mappedImportField(value: string) {
  if (MANUAL_IMPORT_FIELDS.has(value)) return "";
  return value.startsWith("manual:") ? value.slice("manual:".length) : value;
}

const AUTOMATIC_IMPORT_FIELDS = IMPORT_FIELDS.filter(
  (field) => !MANUAL_IMPORT_FIELDS.has(field.key),
);
export const PROGRAMME_SAMPLE = [
  {
    ref: "BTECH-CSE",
    courseName: "Bachelor of Technology",
    degree: "B.Tech",
    stream: "Engineering",
    level: "UG",
    specialization: "Computer Science and Engineering",
    durationYrs: 4,
  },
  {
    ref: "MBA",
    courseName: "Master of Business Administration",
    degree: "MBA",
    stream: "Management",
    level: "PG",
    specialization: "General",
    durationYrs: 2,
  },
  {
    ref: "MCA",
    courseName: "Master of Computer Applications",
    degree: "MCA",
    stream: "Computer Applications",
    level: "PG",
    specialization: "General",
    durationYrs: 2,
  },
];
export const LIMITS = {
  bytes: 10 * 1024 * 1024,
  rows: 500,
  columns: 80,
  cell: 100000,
  expanded: 40 * 1024 * 1024,
  batch: 5,
};
export function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
export function autoMapping(headers: string[]) {
  const names = new Map(
    AUTOMATIC_IMPORT_FIELDS.flatMap((f) =>
      [f.label, f.key, ...(f.aliases || [])].map(
        (n) => [normalize(n), f.key] as const,
      ),
    ),
  );
  return Object.fromEntries(
    headers.map((heading, index) => [
      String(index),
      names.get(normalize(heading)) || "",
    ]),
  );
}
