"use client";

import { useEffect, useState } from "react";
import { blogCollegeSlugs, removeBlogCollege } from "@/lib/blog-content";

type College = { id: string; slug: string; name: string; city: string; state: string };

export function BlogCollegeSelector({ content, onChange }: { content: string; onChange: (value: string) => void }) {
  const slugs = blogCollegeSlugs(content);
  const slugKey = slugs.join(",");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<College[]>([]);
  const [selected, setSelected] = useState<Record<string, College | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const current = slugKey ? slugKey.split(",") : [];
    Promise.all(current.map(async slug => {
      const response = await fetch(`/api/v1/colleges/by-slug/${encodeURIComponent(slug)}`, { signal: controller.signal });
      return [slug, response.ok ? (await response.json()).college : null] as const;
    })).then(items => { if (!controller.signal.aborted) setSelected(Object.fromEntries(items)); }).catch(() => {});
    return () => controller.abort();
  }, [slugKey]);
  useEffect(() => {
    const controller = new AbortController();
    setResults([]); setError("");
    if (query.trim().length < 2) { setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/v1/search/hybrid?q=${encodeURIComponent(query.trim())}&limit=8`, { signal: controller.signal });
        if (!response.ok) throw new Error("Unable to search colleges. Please try again.");
        const data = await response.json();
        if (!controller.signal.aborted) setResults(data.data || []);
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to search colleges."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  return <section className="rounded-xl border bg-card p-5 space-y-3">
    <h2 className="text-sm font-bold">Colleges linked to this article (optional)</h2>
    <p className="text-xs text-muted-foreground">Choose colleges relevant to this article. Choose College blogs only to list the article in these colleges’ Blogs tabs. Website articles stay on the main Blog page. Selected colleges also get recommendation cards in the article.</p>
    {slugs.length === 0 ? <p className="text-xs text-muted-foreground">No colleges selected.</p> : <ul className="divide-y">
      {slugs.map(slug => <li key={slug} className="flex items-center justify-between gap-3 py-2 text-sm">
        <div className="min-w-0"><p className="font-semibold break-words">{selected[slug]?.name || slug}</p>{selected[slug] === null && <p className="text-xs text-amber-700">This college is not currently published.</p>}</div>
        <button type="button" aria-label={`Remove recommendation ${slug}`} onClick={() => onChange(removeBlogCollege(content, slug))} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Remove</button>
      </li>)}
    </ul>}
    <label className="block space-y-1 text-xs font-semibold"><span>Search colleges by name or city</span><input aria-label="Search college recommendations" value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. IIT Bombay" className="w-full rounded-lg border bg-background p-2.5 text-sm" /></label>
    {loading && <p role="status" className="text-xs text-muted-foreground">Searching colleges…</p>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    {!loading && !error && query.trim().length >= 2 && results.length === 0 && <p className="text-xs text-muted-foreground">No published colleges found.</p>}
    {results.length > 0 && <ul className="max-h-64 overflow-y-auto divide-y rounded-lg border p-2">
      {results.map(college => <li key={college.id} className="flex items-center justify-between gap-3 p-2 text-sm">
        <div><p className="font-semibold">{college.name}</p><p className="text-xs text-muted-foreground">{college.city}, {college.state}</p></div>
        <button type="button" disabled={slugs.includes(college.slug)} aria-label={`Recommend ${college.name}`} onClick={() => onChange(`${content}\n\n<EmbeddedCollegeCTA slug="${college.slug}" />\n\n`)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">{slugs.includes(college.slug) ? "Added" : "Add"}</button>
      </li>)}
    </ul>}
  </section>;
}
