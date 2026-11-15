import catalog from "@/data/college-brochures.json";

export const BROCHURE_YEARS = ["2026-27", "2027-28"] as const;
export type BrochureYear = typeof BROCHURE_YEARS[number];
export interface CollegeBrochure {
  id: string;
  year: string;
  title: string;
  programs: string[];
  url: string;
  kind: string;
  checkedAt: string;
}
export function getCollegeBrochures(slug: string): CollegeBrochure[] {
  return (catalog as Record<string, CollegeBrochure[]>)[slug] || [];
}

export function resolveCollegeBrochures(college: { id: string; slug: string; brochurePdfUrl: string | null; courses: { course: { degree: string } }[] }): CollegeBrochure[] {
  const curated = getCollegeBrochures(college.slug);
  const url = college.brochurePdfUrl?.trim();
  if (!url || curated.some(item => item.url === url) || !/^(https?:\/\/|\/(?!\/))/.test(url)) return curated;
  const programs = Array.from(new Set(college.courses.map(item => item.course.degree)));
  const year = url.match(/(20\d{2})[-_](?:20)?(\d{2})/)?.slice(1).join("-") || "Latest available";
  return [{ id: `college-${college.id}-brochure`, year, title: "College admission brochure", programs: programs.length ? programs : ["General admissions"], url, kind: "College-provided admission document", checkedAt: "" }, ...curated];
}
