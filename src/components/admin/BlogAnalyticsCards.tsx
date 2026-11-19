import type { BlogStats } from "@/lib/blog-analytics";
export function BlogAnalyticsCards({ stats }: { stats: BlogStats }) {
  return <section aria-label="Measured blog traffic" className="space-y-2">
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Tracked blog views</p><p className="mt-1 text-2xl font-bold">{stats.views.toLocaleString("en-IN")}</p></div>
      <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Unique visitors</p><p className="mt-1 text-2xl font-bold">{stats.visitors.toLocaleString("en-IN")}</p></div>
    </div>
    <p className="text-xs text-muted-foreground">Measured since tracking was enabled. New views count once per article visit after 45 active seconds; background and unfocused time are excluded. Returning to an article can count again after another 45 active seconds. Earlier recorded views remain in the totals. Unique visitors are browsers across these articles; clearing cookies or using another browser counts separately. Editorial visits and common bots are excluded. Old unverified counters are excluded.</p>
  </section>;
}
