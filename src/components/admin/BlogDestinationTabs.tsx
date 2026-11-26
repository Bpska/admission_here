import Link from "next/link";
export function BlogDestinationTabs({ basePath, selected }: { basePath: string; selected?: string }) {
  return (
    <nav aria-label="Blog sections" className="grid gap-3 sm:grid-cols-3">
      {[
        ["website", "Website Blogs", "Articles on the main website Blog page"],
        ["college", "College Blogs", "Articles in individual colleges’ Blogs sections"],
        ["calendar", "Schedule Calendar", "Full calendar & multi-blog scheduler"],
      ].map(([key, label, description]) => (
        <Link
          key={key}
          href={`${basePath}/${key}`}
          aria-current={(selected || "website") === key ? "page" : undefined}
          className={`rounded-xl border p-4 transition-colors ${
            (selected || "website") === key
              ? "border-primary bg-primary/5"
              : key === "calendar"
              ? "border-purple-200 bg-purple-50/40 hover:bg-purple-50"
              : "bg-card hover:bg-muted/30"
          }`}
        >
          <span className="block font-bold">{label}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
        </Link>
      ))}
    </nav>
  );
}
