import Link from "next/link";
export function CollegeSectionNavigation() {
  const sections = [["overview", "Overview"], ["offerings", "Courses & Fees"], ["admission", "Admission"], ["placements", "Placements"], ["gallery", "Campus Gallery"], ["reviews", "Reviews"], ["qna", "Q&A"], ["blogs", "Blogs"]];
  return <nav aria-label="College sections" className="flex flex-wrap gap-2 rounded-xl border bg-card p-3">{sections.map(([id, title]) => <Link key={id} href={`#college-${id}`} className="rounded-lg border px-3 py-2 text-xs font-semibold text-primary hover:bg-accent">{title}</Link>)}</nav>;
}
