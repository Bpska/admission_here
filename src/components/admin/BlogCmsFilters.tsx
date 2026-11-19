import Link from "next/link";
import type { BlogCmsFilters as Filters } from "@/lib/blog-cms";
export function BlogCmsFilters({ filters, categories, basePath, count, page, pages }: { filters: Filters; categories: string[]; basePath: string; count: number; page: number; pages: number }) {
  const href = (target: number) => { const params = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => { if (value && key !== "page") params.set(key, value); }); params.set("page", String(target)); return `${basePath}?${params}`; };
  const style = "w-full min-w-0 rounded-lg border bg-background px-3 py-2 text-sm";
  return <section className="space-y-4 rounded-xl border bg-card p-4" aria-label="Find articles">
    <form action={basePath} className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-5">
      <input type="hidden" name="destination" value={filters.destination || "all"} />
      <input name="q" aria-label="Search articles" defaultValue={filters.q} placeholder="Search title, slug or author" className={style} />
      <select name="status" aria-label="Article status" defaultValue={filters.status || ""} className={style}><option value="">All statuses</option>{["DRAFT", "PUBLISHED", "IN_REVIEW", "SCHEDULED", "ARCHIVED"].map(status => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}</select>
      <select name="category" aria-label="Article category" defaultValue={filters.category || ""} className={style}><option value="">All categories</option>{categories.map(category => <option key={category} value={category}>{category.replace(/_/g, " ")}</option>)}</select>
      <select name="sort" aria-label="Sort articles" defaultValue={filters.sort || "updated"} className={style}><option value="updated">Recently updated</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select>
      <div className="flex items-center gap-3"><button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Apply</button><Link href={`${basePath}?destination=${filters.destination || "all"}`} className="text-sm underline">Reset</Link></div>
    </form>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-muted-foreground">{count} article{count === 1 ? "" : "s"} · Page {page} of {pages}</p><div className="flex gap-4">{page > 1 && <Link href={href(page - 1)} className="font-semibold text-primary">← Previous</Link>}{page < pages && <Link href={href(page + 1)} className="font-semibold text-primary">Next →</Link>}</div></div>
    {count === 0 && <p className="py-4 text-center text-muted-foreground">No articles match these filters. Try another search or reset the filters.</p>}
  </section>;
}
