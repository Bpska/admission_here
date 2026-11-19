import Link from "next/link";
export function BlogDestinationTabs({ basePath, selected }: { basePath: string; selected?: string }) {
  return <nav aria-label="Blog sections" className="grid gap-3 sm:grid-cols-2">{[["website", "Website Blogs", "Articles on the main website Blog page"], ["college", "College Blogs", "Articles in individual colleges’ Blogs sections"]].map(([key, label, description]) => <Link key={key} href={`${basePath}/${key}`} aria-current={(selected || "website") === key ? "page" : undefined} className={`rounded-xl border p-4 ${(selected || "website") === key ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/30"}`}><span className="block font-bold">{label}</span><span className="mt-1 block text-xs text-muted-foreground">{description}</span></Link>)}</nav>;
}
