"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  IMPORT_FIELDS,
  REMOVED_COLLEGE_FIELDS,
  isRemovedImportColumn,
} from "@/lib/college-import/fields";
import type {
  Decision,
  ImportOptions,
  Plan,
} from "@/lib/college-import/validate";

type Row = {
  id: string;
  rowNumber: number;
  raw: string[];
  decision: Decision;
  preview: Plan;
  status: string;
  message: string | null;
  collegeId: string | null;
};
type Job = {
  id: string;
  version: number;
  fileName: string;
  status: string;
  headers: string[];
  mapping: Record<string, string>;
  options: ImportOptions;
  rows: Row[];
  visibility?: {
    total: number;
    published: number;
    draft: number;
    missing: number;
    colleges: {
      id: string;
      name: string;
      slug: string;
      isPublished: boolean;
    }[];
  };
};
const finished = (row: Row) =>
  ["CREATED", "UPDATED", "SKIPPED"].includes(row.status);
const fieldStyle =
  "w-full min-w-0 rounded-lg border bg-background px-3 py-2 text-sm";
const button =
  "inline-flex min-h-11 items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50";
const primary = button + " bg-primary text-primary-foreground";
async function result(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
const clearable = [
  "shortName",
  "affiliatedTo",
  "fullAddress",
  "pincode",
  "contactPhone",
  "naacGrade",
  "metaTitle",
  "metaDescription",
  "websiteUrl",
  "brochurePdfUrl",
  "logoUrl",
  "coverImageUrl",
  "contactEmail",
  "estYear",
  "nirfRank",
  "campusAreaAcres",
  "overviewHtml",
  "admissionHtml",
  "hostelInfo",
  "scholarshipInfo",
  "approvedBy",
  "galleryUrls",
  "faqsJson",
  "qnaJson",
];
export function CollegeBulkUpload({ initialId }: { initialId?: string }) {
  const [job, setJob] = useState<Job | null>(null),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [publishOnImport, setPublishOnImport] = useState(true);
  const [publishReviewed, setPublishReviewed] = useState(false);
  const [openRows, setOpenRows] = useState<Set<string>>(() => new Set());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!initialId) return;
    setBusy(true);
    fetch(`/api/v1/admin/college-imports/${initialId}`)
      .then(result)
      .then((data: Job) => {
        adopt(data);
        setError("");
        setNotice("");
        setOpenRows(new Set());
      })
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, [initialId]);
  const adopt = (data: Job) => {
    setJob(data);
    setDirty(false);
    setReviewed(false);
    setPublishReviewed(false);
  };
  const edit = (fn: (j: Job) => Job) => {
    setJob((j) => (j ? fn(j) : j));
    setDirty(true);
    setReviewed(false);
    setNotice("Changes need validation before importing.");
  };
  const editRow = (number: number, fn: (r: Row) => Row) =>
    edit((j) => ({
      ...j,
      rows: j.rows.map((r) => (r.rowNumber === number ? fn(r) : r)),
    }));
  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("Reading the file and validating college records…");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("publishOnImport", String(publishOnImport));
      const data = await result(
        await fetch("/api/v1/admin/college-imports", {
          method: "POST",
          body: form,
        }),
      );
      adopt(data);
      window.history.replaceState(null, "", `?import=${data.id}`);
      setNotice(
        "Preview created. No college data has been saved. Review mappings and duplicate decisions.",
      );
    } catch (e) {
      setNotice("");
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const validate = async () => {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      const data = await result(
        await fetch(`/api/v1/admin/college-imports/${job.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: job.version,
            mapping: job.mapping,
            options: job.options,
            rows: job.rows
              .filter((r) => !finished(r))
              .map(({ rowNumber, raw, decision }) => ({
                rowNumber,
                raw,
                decision,
              })),
          }),
        }),
      );
      adopt(data);
      setNotice(
        "Validation complete. Review the refreshed preview before confirming.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const run = async () => {
    if (!job) return;
    setBusy(true);
    setError("");
    setNotice(
      "Importing in recoverable batches. Each college is saved atomically.",
    );
    let current = job;
    try {
      while (mounted.current) {
        const progress = await result(
          await fetch(`/api/v1/admin/college-imports/${job.id}?view=progress`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ confirm: true, version: job.version }),
          }),
        );
        current = {
          ...current,
          status: progress.status,
          visibility: progress.visibility,
          rows: current.rows.map((row) => ({
            ...row,
            ...progress.rows.find((item: Partial<Row>) => item.id === row.id),
          })),
        };
        setJob(current);
        if (current.status !== "IMPORTING") break;
      }
      setNotice(
        current.status === "PARTIAL"
          ? "Import finished with failed rows. Review the messages, correct failed rows, then validate and retry."
          : "Import complete. Download the result report for every row.",
      );
      setReviewed(false);
    } catch (e) {
      setError((e as Error).message);
      setNotice(
        "Completed rows are safe. Reload this import from history to resume any pending rows.",
      );
    } finally {
      setBusy(false);
    }
  };
  const publishSaved = async () => {
    if (!job || !publishReviewed) return;
    setBusy(true);
    setError("");
    try {
      const next = await result(
        await fetch(`/api/v1/admin/college-imports/${job.id}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: true, version: job.version }),
        }),
      );
      adopt(next);
      setNotice(
        `${next.visibility.published} imported colleges are published and available on the public website.`,
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const savedVisibility = (row: Row) => {
    const college = job?.visibility?.colleges.find(
      (college) => college.id === row.collegeId,
    );
    if (college) return college.isPublished ? " · Published" : " · Draft";
    return typeof row.preview.profile.isPublished === "boolean"
      ? row.preview.profile.isPublished
        ? " · Published"
        : " · Draft"
      : "";
  };
  const resetUpload = () => {
    setJob(null);
    setFile(null);
    setDirty(false);
    setReviewed(false);
    setError("");
    setNotice("");
    setOpenRows(new Set());
    window.history.replaceState(null, "", window.location.pathname);
    const input = document.getElementById("college-file");
    if (input instanceof HTMLInputElement) {
      input.value = "";
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };
  const prepareSkipped = async () => {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      const next = await result(
        await fetch(`/api/v1/admin/college-imports/${job.id}/updates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: job.version }),
        }),
      );
      adopt(next);
      setOpenRows(new Set());
      window.history.replaceState(null, "", `?import=${next.id}`);
      setNotice(
        "Skipped rows are ready in a new preview. Choose Update clear matches, validate, then review and confirm. No college has been changed.",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const selectMatchedUpdates = () => {
    if (!job) return;
    const count = job.rows.filter(
      (row) =>
        !finished(row) &&
        row.preview.candidates.length === 1 &&
        row.preview.candidates[0].confidence === "strong",
    ).length;
    edit((current) => ({
      ...current,
      options: { ...current.options, allowUpdates: true },
      rows: current.rows.map((row) => {
        if (
          finished(row) ||
          row.preview.sample ||
          row.preview.candidates.length !== 1 ||
          row.preview.candidates[0].confidence !== "strong"
        )
          return row;
        return {
          ...row,
          decision: {
            action: "update",
            targetId: row.preview.candidates[0].id,
            confirmed: true,
          },
        };
      }),
    }));
    setNotice(
      `${count} clear matches selected for update. Validate and review the changed fields before confirming. Uncertain matches were left unchanged.`,
    );
  };
  const isComplete = job?.status === "COMPLETED";
  const savedRows =
    job?.rows.filter(
      (row) => row.status === "CREATED" || row.status === "UPDATED",
    ) || [];
  const skippedRows =
    job?.rows.filter(
      (row) => row.status === "SKIPPED" && !row.preview.sample,
    ) || [];
  const clearMatches =
    job?.rows.filter(
      (row) =>
        !finished(row) &&
        !row.preview.sample &&
        row.preview.candidates.length === 1 &&
        row.preview.candidates[0].confidence === "strong",
    ).length || 0;
  const plans = job?.rows.map((r) => r.preview) || [];
  const invalid = plans.filter((p) => p.errors.length).length;
  const errorGroups = new Map<string, number[]>();
  for (const row of job?.rows || []) {
    for (const error of new Set(row.preview.errors)) {
      const numbers = errorGroups.get(error) || [];
      numbers.push(row.rowNumber);
      errorGroups.set(error, numbers);
    }
  }
  const showInvalidRows = () => {
    if (!job) return;
    const invalidRows = job.rows.filter((row) => row.preview.errors.length);
    for (const row of invalidRows) {
      const element = document.getElementById(`college-import-row-${row.id}`);
      if (element instanceof HTMLDetailsElement) element.open = true;
    }
    if (invalidRows[0])
      document
        .getElementById(`college-import-row-${invalidRows[0].id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const skippedPlans = plans.filter(
    (plan) => plan.choice.action === "skip",
  ).length;
  const creatingPlans = plans.filter(
    (plan) => plan.choice.action === "create" && !plan.sample,
  ).length;
  const updatingPlans = plans.filter(
    (plan) => plan.choice.action === "update",
  ).length;
  const summary = job
    ? [
        ["Total rows", job.rows.length],
        [
          "New colleges",
          plans.filter((p) => !p.sample && p.choice.action === "create").length,
        ],
        ["Existing colleges", plans.filter((p) => p.candidates.length).length],
        [
          "Valid records",
          plans.filter((p) => !p.errors.length && p.choice.action !== "skip")
            .length,
        ],
        ["Invalid records", invalid],
        ["Duplicate matches", plans.filter((p) => p.candidates.length).length],
        ["Programmes to add", plans.reduce((n, p) => n + p.programmeAdds, 0)],
        [
          "Programmes to update",
          plans.reduce((n, p) => n + p.programmeUpdates, 0),
        ],
      ]
    : [];
  const completed =
    job?.rows.filter((r) => r.status !== "PENDING" && r.status !== "FAILED")
      .length || 0;
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Bulk upload colleges</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            One worksheet. One row per college. Add multiple programmes using
            JSON, without college or course IDs.
          </p>
        </div>
        <Link href="/admin/colleges" className={button}>
          Back to colleges
        </Link>
      </div>
      <div className="flex flex-wrap gap-3">
        <a href="/api/v1/admin/college-imports/template" className={button}>
          Download Excel template
        </a>
        <Link href="/admin/colleges/import-history" className={button}>
          Import history
        </Link>
      </div>
      <details className="rounded-xl border bg-card p-4">
        <summary className="cursor-pointer font-semibold">
          How to prepare your file
        </summary>
        <div className="mt-3 space-y-3 text-sm text-muted-foreground">
          <p>
            Download the single-sheet template. The sample row is marked SAMPLE
            and is always skipped. Delete it or replace it and clear the Sample
            Row cell. Fill College Name, City and State for each new college;
            choose College Type to avoid relying on the existing form default.
          </p>
          <p>
            Use Programmes JSON for B.Tech, MBA, MCA and other degrees linked to
            the same college. Use each programme’s unique ref in programme-level
            Placements JSON. Fees and packages must be plain INR numbers. Leave
            optional values blank when unknown.
          </p>
          <p>
            Maximum 10 MB, 500 college rows, 80 columns. Only .xlsx and UTF-8
            comma-separated .csv are supported. Formulas, macros, merged cells
            and multiple sheets are rejected. Image links are saved as
            references; files are not fetched from remote URLs.
          </p>
          <p>
            The upload form is set to publish selected colleges when you confirm
            the import. Turn off that option to save new colleges as Draft.
            Uploading a file only creates a preview. Blank cells preserve
            existing values, and completed rows cannot be imported again.
          </p>
        </div>
      </details>
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <label className="block text-sm font-semibold" htmlFor="college-file">
          Choose Excel or CSV file
        </label>
        <input
          id="college-file"
          type="file"
          accept=".xlsx,.csv"
          disabled={busy || job?.status === "IMPORTING"}
          className={fieldStyle}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <label className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={publishOnImport}
            disabled={busy || job?.status === "IMPORTING"}
            onChange={(event) => setPublishOnImport(event.target.checked)}
          />
          <span>
            <span className="block font-semibold">
              Publish colleges on the website when I confirm this import
            </span>
            <span className="text-xs text-muted-foreground">
              Selected by default. Turn off to save new colleges as Draft. No
              college is created or published during upload/preview.
            </span>
          </span>
        </label>
        <button
          disabled={!file || busy || job?.status === "IMPORTING"}
          className={primary}
          onClick={upload}
        >
          {busy && !job ? "Reading file…" : "Upload and preview"}
        </button>
      </section>
      {error && (
        <div
          role="alert"
          className="whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {notice && (
        <p role="status" className="rounded-xl border bg-card p-4 text-sm">
          {notice}
        </p>
      )}
      {job && (
        <>
          {isComplete && (
            <section
              role="status"
              className="space-y-4 rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950"
            >
              <h2 className="text-xl font-bold">
                {savedRows.length
                  ? "Import finished successfully"
                  : "No colleges were changed"}
              </h2>
              <p>
                {job.rows.filter((row) => row.status === "CREATED").length}{" "}
                colleges created ·{" "}
                {job.rows.filter((row) => row.status === "UPDATED").length}{" "}
                updated · {skippedRows.length} existing colleges skipped · 0
                failed.
              </p>
              <p>
                {job.visibility &&
                job.visibility.total > 0 &&
                job.visibility.draft === 0
                  ? "Your saved colleges are published and available in the public directory. The homepage features a selection of published colleges."
                  : "Saved Draft colleges are hidden publicly. Use Publish imported colleges below when you want them on the website."}
              </p>
              {job.visibility && job.visibility.total > 0 && (
                <div className="space-y-3 rounded-lg border border-emerald-200 bg-white p-4">
                  <p className="font-semibold">
                    Website visibility: {job.visibility.published} published ·{" "}
                    {job.visibility.draft} Draft
                  </p>
                  {job.visibility.draft > 0 && (
                    <>
                      <p className="text-sm">
                        Draft colleges are saved, but hidden from the homepage,
                        public directory and search. Publish them when their
                        information is ready.
                      </p>
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          disabled={busy}
                          checked={publishReviewed}
                          onChange={(event) =>
                            setPublishReviewed(event.target.checked)
                          }
                        />
                        I reviewed these imported colleges and want to make them
                        visible on the public website.
                      </label>
                      <button
                        className={primary}
                        disabled={busy || !publishReviewed}
                        onClick={publishSaved}
                      >
                        Publish {job.visibility.draft} imported colleges
                      </button>
                    </>
                  )}
                  {job.visibility.published > 0 && (
                    <div className="flex flex-wrap gap-4 text-sm font-semibold">
                      <a
                        href="/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        View homepage
                      </a>
                      <a
                        href="/colleges"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        View all published colleges
                      </a>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    The homepage features a limited selection. The public
                    directory contains every published college.
                  </p>
                  {job.visibility.missing > 0 && (
                    <p className="text-sm">
                      {job.visibility.missing} previously imported college(s)
                      were removed and cannot be published from this result.
                    </p>
                  )}
                </div>
              )}
              {!savedRows.length && (
                <p>
                  All rows were set to Skip. Use Prepare updates below if you
                  want to apply the spreadsheet to existing colleges.
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Link href="/admin/colleges" className={primary}>
                  View saved colleges
                </Link>
                {skippedRows.length > 0 && (
                  <button
                    className={button}
                    disabled={busy}
                    onClick={prepareSkipped}
                  >
                    Prepare updates for {skippedRows.length} skipped colleges
                  </button>
                )}
                <button
                  className={button}
                  disabled={busy}
                  onClick={resetUpload}
                >
                  Upload another file
                </button>
              </div>
              {savedRows.length > 0 && (
                <ul className="space-y-2">
                  {savedRows.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-white p-3 text-sm"
                    >
                      <span className="font-semibold">
                        {row.preview.name}{" "}
                        <span className="font-normal">
                          · {row.status === "CREATED" ? "Created" : "Updated"}
                          {savedVisibility(row)}
                        </span>
                      </span>
                      <Link
                        className="font-semibold underline"
                        href={`/admin/colleges/${row.collegeId}/edit`}
                      >
                        Open college editor
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{job.fileName}</h2>
              <p className="text-sm text-muted-foreground">
                {job.status} · Preview version {job.version}
              </p>
            </div>
            <a
              href={`/api/v1/admin/college-imports/${job.id}/report`}
              className={button}
            >
              Download result / error report
            </a>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summary.map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border bg-card p-4"
              >
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>
          <details open={!isComplete} className="rounded-xl border bg-card p-5">
            <summary className="cursor-pointer font-bold">
              Column mapping
            </summary>
            <p className="my-3 text-sm text-muted-foreground">
              Match each heading to an admin field. Unmatched headings are
              marked. Select Ignore if they are not needed.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {job.headers.map((heading, i) =>
                isRemovedImportColumn(heading) ||
                REMOVED_COLLEGE_FIELDS.has(job.mapping[i]) ? null : (
                  <label className="block space-y-1 text-xs" key={i}>
                    <span className="font-semibold">
                      {heading}
                      {!job.mapping[i] && (
                        <span className="ml-2 text-amber-700">
                          Unmatched / ignored
                        </span>
                      )}
                    </span>
                    <select
                      disabled={
                        busy ||
                        job.status === "IMPORTING" ||
                        !!job.rows.some(finished)
                      }
                      className={fieldStyle}
                      value={job.mapping[i] || ""}
                      onChange={(e) =>
                        edit((j) => ({
                          ...j,
                          mapping: { ...j.mapping, [i]: e.target.value },
                        }))
                      }
                    >
                      <option value="">Ignore this column</option>
                      {IMPORT_FIELDS.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ),
              )}
            </div>
          </details>
          <section className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-bold">Import permissions</h2>
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                disabled={busy || job.status === "IMPORTING" || isComplete}
                checked={!!job.options.publishOnImport}
                onChange={(event) =>
                  edit((current) => ({
                    ...current,
                    options: {
                      ...current.options,
                      publishOnImport: event.target.checked,
                      allowPublish: event.target.checked
                        ? true
                        : current.options.allowPublish,
                    },
                  }))
                }
              />
              <span>
                <span className="block font-semibold">
                  Publish selected colleges when I confirm
                </span>
                <span className="text-xs text-muted-foreground">
                  Overrides Draft or blank status cells for rows set to Create
                  or Update. Skipped colleges stay unchanged.
                </span>
              </span>
            </label>
            {!isComplete && clearMatches > 0 && (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm">
                  {clearMatches} existing colleges have one clear match. Select
                  them together to avoid changing every row separately.
                </p>
                <button
                  type="button"
                  className={button}
                  disabled={busy || job.status === "IMPORTING"}
                  onClick={selectMatchedUpdates}
                >
                  Update clear matches ({clearMatches})
                </button>
                <p className="text-xs text-muted-foreground">
                  This only prepares update decisions. Validation and final
                  confirmation are still required.
                </p>
              </div>
            )}
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                disabled={busy || job.status === "IMPORTING" || isComplete}
                checked={job.options.allowUpdates}
                onChange={(e) =>
                  edit((j) => ({
                    ...j,
                    options: { ...j.options, allowUpdates: e.target.checked },
                  }))
                }
              />
              Allow updates to existing colleges. Supplied fields and matching
              linked records may change; blank fields are preserved.
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                disabled={busy || job.status === "IMPORTING" || isComplete}
                checked={job.options.allowPublish}
                onChange={(e) =>
                  edit((j) => ({
                    ...j,
                    options: {
                      ...j.options,
                      allowPublish: e.target.checked,
                      publishOnImport: e.target.checked
                        ? j.options.publishOnImport
                        : false,
                    },
                  }))
                }
              />
              Allow explicit Published cells and blog publish choices to publish
              records. Without Publish when confirmed, new colleges with blank
              status stay Draft.
            </label>
          </section>
          {invalid > 0 && (
            <section
              aria-label="Upload validation errors"
              className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              <h2 className="font-bold">{invalid} row(s) need correction</h2>
              <p>
                Correct the values below, then click Validate changes. College
                Type supports PUBLIC_GOVERNMENT, PRIVATE, DEEMED, AUTONOMOUS and
                AIDED.
              </p>
              {dirty && (
                <p className="font-semibold">
                  These messages are from the last validation. Validate changes
                  to refresh them.
                </p>
              )}
              <ul className="list-disc space-y-2 break-words pl-5">
                {[...errorGroups].map(([message, numbers]) => (
                  <li key={message}>
                    <span className="font-semibold">{numbers.length} row(s): </span>
                    {message}
                    <span className="block text-xs">
                      Rows {numbers.slice(0, 10).join(", ")}
                      {numbers.length > 10 ? ` and ${numbers.length - 10} more` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="space-y-3">
            {job.rows.map((row) => (
              <details
                id={`college-import-row-${row.id}`}
                key={row.id}
                className="rounded-xl border bg-card p-4"
                onToggle={(event) => {
                  const open = event.currentTarget.open;
                  setOpenRows((previous) => {
                    const next = new Set(previous);
                    if (open) next.add(row.id);
                    else next.delete(row.id);
                    return next;
                  });
                }}
              >
                <summary className="cursor-pointer">
                  <span className="font-semibold">
                    Row {row.rowNumber}: {row.preview.name}
                  </span>
                  <span className="ml-3 text-xs text-muted-foreground">
                    {row.status} · {row.decision.action}
                    {row.preview.errors.length
                      ? ` · ${row.preview.errors.length} error(s)`
                      : ""}
                    {dirty ? " · Revalidation needed" : ""}
                  </span>
                  {row.preview.errors.map((message, index) => (
                    <span
                      key={index}
                      className="mt-1 block break-words text-sm text-red-700"
                    >
                      {message}
                    </span>
                  ))}
                </summary>
                {openRows.has(row.id) && (
                  <div className="mt-4 space-y-4">
                    {row.message && (
                      <p
                        className={`whitespace-pre-wrap text-sm ${row.status === "FAILED" ? "text-red-700" : "text-muted-foreground"}`}
                      >
                        {row.message}
                      </p>
                    )}
                    {row.preview.warnings.length > 0 && (
                      <ul className="list-disc space-y-1 pl-5 text-xs text-amber-800">
                        {row.preview.warnings.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    )}
                    {!finished(row) && !row.preview.sample && (
                      <fieldset
                        disabled={
                          busy || job.status === "IMPORTING" || isComplete
                        }
                        className="space-y-3"
                      >
                        <legend className="mb-2 text-sm font-bold">
                          Duplicate decision
                        </legend>
                        <label className="block max-w-md space-y-1 text-xs">
                          <span>Action for this college</span>
                          <select
                            className={fieldStyle}
                            value={row.decision.action}
                            onChange={(e) =>
                              editRow(row.rowNumber, (r) => ({
                                ...r,
                                decision: {
                                  action: e.target.value as Decision["action"],
                                  targetId:
                                    r.preview.candidates.length === 1
                                      ? r.preview.candidates[0].id
                                      : undefined,
                                  confirmed: false,
                                },
                              }))
                            }
                          >
                            <option value="skip">
                              Skip existing college / this row
                            </option>
                            <option value="update">
                              Update existing college
                            </option>
                            <option value="create">Create new college</option>
                          </select>
                        </label>
                        {row.preview.candidates.length > 0 && (
                          <div className="space-y-2 rounded-lg border p-3">
                            <p className="text-sm font-semibold">
                              Possible existing colleges
                            </p>
                            {row.preview.candidates.map((c) => (
                              <label
                                key={c.id}
                                className="flex items-start gap-2 text-sm"
                              >
                                <input
                                  type="radio"
                                  name={`target-${row.id}`}
                                  disabled={row.decision.action !== "update"}
                                  checked={row.decision.targetId === c.id}
                                  onChange={() =>
                                    editRow(row.rowNumber, (r) => ({
                                      ...r,
                                      decision: {
                                        ...r.decision,
                                        targetId: c.id,
                                        confirmed: false,
                                      },
                                    }))
                                  }
                                />
                                <span>
                                  {c.name} — {c.city}, {c.state}
                                  <span className="block text-xs text-muted-foreground">
                                    {c.confidence} match: {c.reason}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                        {(row.decision.action === "update" ||
                          (row.decision.action === "create" &&
                            row.preview.candidates.length > 0)) && (
                          <label className="flex gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={!!row.decision.confirmed}
                              onChange={(e) =>
                                editRow(row.rowNumber, (r) => ({
                                  ...r,
                                  decision: {
                                    ...r.decision,
                                    confirmed: e.target.checked,
                                  },
                                }))
                              }
                            />
                            {row.decision.action === "update"
                              ? "I confirm this is the correct existing college to update."
                              : "I confirm this is a separate institution and should be created despite the possible match."}
                          </label>
                        )}
                        {row.decision.action === "update" && (
                          <details>
                            <summary className="cursor-pointer text-sm font-semibold">
                              Explicitly clear existing optional fields
                            </summary>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Only checked fields will be cleared. Leaving an
                              uploaded cell blank does not clear saved data.
                            </p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {IMPORT_FIELDS.filter((f) =>
                                clearable.includes(f.key),
                              )
                                .concat([
                                  {
                                    key: "facilitiesJson",
                                    label: "Facilities List",
                                    hint: "",
                                  },
                                ])
                                .map((f) => (
                                  <label
                                    key={f.key}
                                    className="flex gap-2 text-xs"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={
                                        row.decision.clearFields?.includes(
                                          f.key,
                                        ) || false
                                      }
                                      onChange={(e) =>
                                        editRow(row.rowNumber, (r) => ({
                                          ...r,
                                          decision: {
                                            ...r.decision,
                                            clearFields: e.target.checked
                                              ? [
                                                  ...(r.decision.clearFields ||
                                                    []),
                                                  f.key,
                                                ]
                                              : (
                                                  r.decision.clearFields || []
                                                ).filter((k) => k !== f.key),
                                          },
                                        }))
                                      }
                                    />
                                    Clear {f.label}
                                  </label>
                                ))}
                            </div>
                          </details>
                        )}
                      </fieldset>
                    )}
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold">
                        Review mapped college details and linked records
                      </summary>
                      <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted/40 p-3 text-xs">
                        {JSON.stringify(
                          {
                            college: row.preview.profile,
                            programmes: row.preview.programmes,
                            placements: row.preview.placements,
                            blog: row.preview.blog,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                    {!finished(row) && (
                      <details>
                        <summary className="cursor-pointer text-sm font-semibold">
                          Correct uploaded cells
                        </summary>
                        <fieldset
                          disabled={
                            busy || job.status === "IMPORTING" || isComplete
                          }
                          className="mt-3 grid gap-4 sm:grid-cols-2"
                        >
                          {job.headers.map((heading, index) =>
                            isRemovedImportColumn(heading) ||
                            REMOVED_COLLEGE_FIELDS.has(
                              job.mapping[index],
                            ) ? null : (
                              <label
                                key={index}
                                className={`block space-y-1 text-xs ${/json|overview|content|procedure/i.test(heading) ? "sm:col-span-2" : ""}`}
                              >
                                <span className="font-semibold">{heading}</span>
                                <textarea
                                  className={fieldStyle}
                                  rows={
                                    /json|overview|content|procedure/i.test(
                                      heading,
                                    )
                                      ? 5
                                      : 2
                                  }
                                  value={row.raw[index] || ""}
                                  onChange={(e) =>
                                    editRow(row.rowNumber, (r) => ({
                                      ...r,
                                      raw: r.raw.map((v, i) =>
                                        i === index ? e.target.value : v,
                                      ),
                                    }))
                                  }
                                />
                              </label>
                            ),
                          )}
                        </fieldset>
                      </details>
                    )}
                    {row.collegeId && (
                      <Link
                        href={`/admin/colleges/${row.collegeId}/edit`}
                        className="inline-block text-sm font-semibold text-primary underline"
                      >
                        Open imported college
                      </Link>
                    )}
                  </div>
                )}
              </details>
            ))}
          </div>
          {!isComplete && (
            <section className="sm:sticky sm:bottom-0 space-y-4 rounded-xl border bg-card p-4 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">
                  {completed} / {job.rows.length} rows completed ·{" "}
                  {job.rows.filter((r) => r.status === "FAILED").length} failed
                </p>
                <progress
                  className="h-2 w-full sm:w-64"
                  max={job.rows.length}
                  value={job.rows.filter((r) => r.status !== "PENDING").length}
                  aria-label="Import progress"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Planned actions: {creatingPlans} new · {updatingPlans} updates ·{" "}
                {skippedPlans} skipped. Existing colleges set to Skip will
                remain unchanged.
              </p>
              {invalid > 0 && (
                <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">
                    Import blocked: {invalid} row(s) need correction.
                  </p>
                  <p>
                    These are validation errors, not failed imports. Fix the
                    rows or choose Skip, then revalidate.
                  </p>
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={showInvalidRows}
                  >
                    Show rows needing correction
                  </button>
                </div>
              )}
              {dirty && (
                <p className="text-sm font-semibold text-amber-800">
                  Your changes need validation. Click Validate changes before
                  confirming.
                </p>
              )}
              {!dirty &&
                !invalid &&
                !reviewed &&
                job.rows.some((row) => row.status === "PENDING") && (
                  <p className="text-sm font-semibold text-primary">
                    Ready for review. Tick the checkbox below to enable Confirm
                    and import.
                  </p>
                )}
              <p className="text-sm font-semibold">
                {job.options.publishOnImport
                  ? "After confirmation: selected colleges will be published on the website."
                  : "After confirmation: new colleges without a Published status will be saved as Draft."}
              </p>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={busy || dirty}
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                I reviewed this preview and confirm these import decisions.
                Completed rows will not be imported again.
              </label>
              <div className="admin-form-actions flex flex-wrap gap-3">
                <button
                  className={button}
                  disabled={
                    busy ||
                    job.status === "IMPORTING" ||
                    !job.rows.some((r) => !finished(r))
                  }
                  onClick={validate}
                >
                  {dirty ? "Validate changes" : "Revalidate / prepare retry"}
                </button>
                <button
                  className={primary}
                  disabled={
                    busy ||
                    dirty ||
                    !reviewed ||
                    !!invalid ||
                    !job.rows.some((r) => r.status === "PENDING")
                  }
                  onClick={run}
                >
                  {busy
                    ? "Working…"
                    : job.status === "IMPORTING"
                      ? "Resume import"
                      : "Confirm and import"}
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
