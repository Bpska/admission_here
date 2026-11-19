export function programKey(degree: string) {
  const compact = degree.toLowerCase().replace(/[^a-z0-9]/g, "");
  const known: Record<string, string> = { btech: "b-tech", be: "b-e", mtech: "m-tech", me: "m-e", mca: "mca", bca: "bca", mba: "mba", bba: "bba", mbbs: "mbbs", bds: "bds", phd: "phd", diploma: "diploma" };
  return known[compact] || degree.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
export function collegeProgramHref(slug: string, program: string, tab = "") { return `/college/${slug}/programs/${program}${tab ? `/${tab}` : ""}`; }
export function programChoices(offerings: { course: { degree: string; fullName: string; stream: string } }[]) {
  return [...new Map(offerings.map(offering => [programKey(offering.course.degree), { key: programKey(offering.course.degree), label: offering.course.degree, stream: offering.course.stream }])).values()];
}
export const PROGRAM_TABS = ["", "courses-fees", "admission", "cutoff", "placements", "rankings", "gallery", "reviews", "qna", "blogs"];
