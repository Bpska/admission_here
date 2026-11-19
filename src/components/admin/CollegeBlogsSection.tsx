"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Data = { college: { slug: string; isPublished: boolean }; canCreate: boolean; posts: { id: string; slug: string; title: string; status: string; canEdit: boolean }[] };
export function CollegeBlogsSection({ collegeId }: { collegeId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError("");
    fetch(`/api/v1/cms/colleges/${collegeId}/blogs`, { signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Unable to load college articles.");
      if (!controller.signal.aborted) setData(result);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [collegeId, attempt]);
  return <section id="college-blogs" className="scroll-mt-6 space-y-4 rounded-xl border bg-card p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">College blogs</h2><button type="button" onClick={() => setAttempt(attempt + 1)} className="text-xs text-primary underline">Refresh articles</button></div>
    <p className="text-sm text-muted-foreground">Articles linked to this college appear on its Blogs tab after publication.</p>
    {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : !data ? <p role="status" className="text-sm">Loading articles…</p> : <>
      {data.canCreate && <Link href={`/admin/blogs/new?college=${encodeURIComponent(data.college.slug)}`} className="inline-block rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Write blog for this college</Link>}
      {!data.college.isPublished && <p className="text-sm text-muted-foreground">Publish this college before linking new articles through the blog editor.</p>}
      {data.posts.length === 0 && <p className="text-sm text-muted-foreground">No articles are linked to this college yet.</p>}
      <ul className="divide-y">{data.posts.map(post => <li key={post.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><div><p className="font-semibold">{post.title}</p><p className="text-xs text-muted-foreground">{post.status.replace(/_/g, " ")}</p></div><div className="flex gap-3">{post.status === "PUBLISHED" && <Link className="text-primary underline" href={`/college/${data.college.slug}/blogs/${post.slug}`}>Read</Link>}{post.canEdit && <Link className="text-primary underline" href={`/admin/blogs/${post.id}/edit`}>Edit article</Link>}</div></li>)}</ul>
    </>}
  </section>;
}
