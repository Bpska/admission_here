"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export function CollegeImportHistory() {
  const [data, setData] = useState<any>(null),
    [page, setPage] = useState(1),
    [error, setError] = useState("");
  useEffect(() => {
    setError("");
    setData(null);
    fetch(`/api/v1/admin/college-imports?page=${page}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        return body;
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [page]);
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">College import history</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Preview, resume and inspect past uploads. College records change
            only after confirmation.
          </p>
        </div>
        <Link
          href="/admin/colleges/bulk-upload"
          className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
        >
          Bulk upload colleges
        </Link>
      </div>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {!data && !error && <p>Loading imports…</p>}
      {data && (
        <>
          <p className="text-sm text-muted-foreground">
            {data.total} upload(s) · Page {page}
          </p>
          <div className="space-y-4">
            {data.jobs.map((job: any) => (
              <article
                key={job.id}
                className="space-y-3 rounded-xl border bg-card p-5"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <h2 className="font-bold break-all">{job.fileName}</h2>
                  <span className="text-xs font-semibold">{job.status}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(job.createdAt).toLocaleString("en-IN")} ·{" "}
                  {job.actorName}
                </p>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    ["Total records", job.summary.total],
                    ["Created", job.summary.created],
                    ["Updated", job.summary.updated],
                    ["Failed", job.summary.failed],
                    ["Skipped", job.summary.skipped],
                    ["Pending", job.summary.pending],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="font-bold">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap gap-4 text-sm font-semibold">
                  <Link
                    className="text-primary underline"
                    href={`/admin/colleges/bulk-upload?import=${job.id}`}
                  >
                    Inspect / resume
                  </Link>
                  <a
                    className="text-primary underline"
                    href={`/api/v1/admin/college-imports/${job.id}/report`}
                  >
                    Download results / errors
                  </a>
                </div>
              </article>
            ))}
            {!data.jobs.length && (
              <p className="rounded-xl border p-6">
                No college imports yet. Start with the Excel template.
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              className="rounded-lg border px-4 py-2 disabled:opacity-50"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <button
              className="rounded-lg border px-4 py-2 disabled:opacity-50"
              disabled={page * 20 >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
