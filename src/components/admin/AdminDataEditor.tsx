"use client";

import { useCallback, useEffect, useState } from "react";
import { ADMIN_RESOURCES, type AdminField } from "@/lib/admin-data-config";
import { useRouter } from "next/navigation";

export function AdminDataEditor({ resource, collegeId }: { resource: string; collegeId?: string }) {
  const router = useRouter();
  const config = ADMIN_RESOURCES[resource];
  const [rows, setRows] = useState<any[]>([]);
  const [options, setOptions] = useState<Record<string, any[]>>({});
  const [readOnly, setReadOnly] = useState(false);
  const [draft, setDraft] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const endpoint = `/api/v1/admin/data/${resource}${collegeId ? `?collegeId=${collegeId}` : ""}`;
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(endpoint); const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRows(data.rows); setOptions(data.options); setReadOnly(data.readOnly);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to load records"); }
    finally { setLoading(false); }
  }, [endpoint]);
  useEffect(() => { setDraft(null); setError(""); setMessage(""); setSearch(""); load(); }, [load]);
  const edit = (row: any = {}) => {
    const result: Record<string, any> = { id: row.id };
    for (const field of config.fields) {
      let value = row[field.key];
      if (resource === "exams" && ["durationMinutes", "totalMarks", "examMode", "counselingSchedule"].includes(field.key)) value = row.patternJson?.[field.key];
      if (field.key === "minimumClass12Percent") value = row.eligibilityCriteria?.min_12th_pct;
      if (field.key === "eligibilityDescription") value = row.eligibilityCriteria?.description;
      if (field.type === "list") value = (value || []).join(", ");
      if (field.type === "datetime-local" && value) { const date = new Date(value); value = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
      result[field.key] = value ?? (field.type === "checkbox" ? true : field.options?.[0] || "");
    }
    setDraft(result); setError(""); setMessage("");
  };
  const save = async (operation: "POST" | "PATCH" | "DELETE", record: Record<string, any>) => {
    if (busy) return;
    if (operation === "DELETE" && !confirm("Delete this record? This cannot be undone.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const data: Record<string, any> = {};
      if (operation !== "DELETE") for (const field of config.fields) {
        const value = record[field.key];
        if (field.type === "password" && !value) continue;
        data[field.key] = field.type === "list" ? String(value || "").split(",").map(v => v.trim()).filter(Boolean)
          : field.type === "number" ? (value === "" ? null : Number(value))
          : field.type === "datetime-local" ? (value ? new Date(value).toISOString() : null)
          : value === "" && !field.required ? null : value;
      }
      const response = await fetch(endpoint, { method: operation, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: record.id, collegeId, data }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setDraft(null); setMessage(result.message || (operation === "DELETE" ? "Record deleted." : "Changes saved.")); await load(); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save changes"); }
    finally { setBusy(false); }
  };
  const caption = (row: any) => row.name || row.fullName || (row.specialization ? `${row.course?.degree || ""} — ${row.specialization}` : row.exam ? `${row.exam.name} · ${row.collegeCourse?.specialization} · ${row.academicYear} · Round ${row.counselingRound}` : row.agencyName ? `${row.agencyName} · ${row.category} · ${row.rankingYear}` : `Batch ${row.batchYear}`);
  const input = (field: AdminField) => {
    const common = { id: `${resource}-${field.key}`, name: field.key, required: field.required, disabled: busy, value: draft?.[field.key] ?? "", onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setDraft(previous => ({ ...previous, [field.key]: event.target.value })), className: "w-full min-w-0 rounded-lg border bg-background p-2.5 text-sm" };
    if (field.type === "checkbox") return <input id={common.id} type="checkbox" checked={Boolean(draft?.[field.key])} disabled={busy} onChange={event => setDraft(previous => ({ ...previous, [field.key]: event.target.checked }))} />;
    if (field.type === "textarea") return <textarea {...common} rows={4} />;
    if (field.type === "select") return <select {...common}><option value="">Select {field.label.toLowerCase()}</option>{field.reference ? (options[field.reference] || []).map(option => <option key={option.id} value={option.id}>{option.name || option.fullName || `${option.course?.degree || ""} ${option.specialization}`}</option>) : field.options?.map(value => <option key={value} value={value}>{value}</option>)}</select>;
    return <input {...common} type={field.type === "list" ? "text" : field.type || "text"} min={field.min} max={field.max} step={field.step || (field.type === "number" ? "1" : undefined)} autoComplete={field.type === "password" ? "new-password" : "off"} />;
  };
  return <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{config.label}</h2>{!readOnly && <button type="button" disabled={busy || loading} onClick={() => edit()} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Add record</button>}</div>
    {error && <p role="alert" className="text-sm text-red-700 bg-red-50 p-3 rounded">{error}</p>}
    {message && <p role="status" className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded">{message}</p>}
    {draft && <form onSubmit={event => { event.preventDefault(); save(draft.id ? "PATCH" : "POST", draft); }} className="space-y-4 border rounded-lg p-4">
      <h3 className="font-bold">{draft.id ? "Edit record" : "New record"}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{config.fields.map(field => <div key={field.key} className={`min-w-0 space-y-1 ${field.type === "textarea" ? "md:col-span-2" : ""}`}><label htmlFor={`${resource}-${field.key}`} className="block text-xs font-semibold">{field.label}{field.required ? " *" : ""}</label>{input(field)}</div>)}</div>
      <div className="flex gap-3"><button disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground text-sm">{busy ? "Saving…" : "Save record"}</button><button type="button" disabled={busy} onClick={() => setDraft(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button></div>
    </form>}
    <input aria-label={`Search ${config.label}`} placeholder="Search records…" className="w-full rounded-lg border p-2.5 text-sm" value={search} onChange={event => setSearch(event.target.value)} />
    {loading ? <p role="status" className="text-sm">Loading records…</p> : <div className="divide-y">{rows.filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())).map(row => <div key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
      <div className="min-w-0"><p className="font-semibold text-sm break-words">{caption(row)}</p><dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">{config.fields.filter(field => !["password", "textarea"].includes(field.type || "") && !field.reference).map(field => <div key={field.key}><dt className="inline">{field.label}: </dt><dd className="inline">{typeof row[field.key] === "boolean" ? (row[field.key] ? "Yes" : "No") : Array.isArray(row[field.key]) ? row[field.key].join(", ") : String(row[field.key] ?? "—")}</dd></div>)}</dl></div>
      {!readOnly && <div className="flex gap-2"><button type="button" disabled={busy} className="border px-3 py-1.5 rounded text-xs" onClick={() => edit(row)}>Edit</button><button type="button" disabled={busy} className="border border-red-200 text-red-700 px-3 py-1.5 rounded text-xs" onClick={() => save("DELETE", row)}>Delete</button></div>}
    </div>)}{rows.length === 0 && <p className="py-5 text-sm text-muted-foreground">No records yet. Add one to populate this section.</p>}</div>}
    {readOnly && <p className="text-xs text-muted-foreground">The shared course catalog can be edited by a Super Administrator.</p>}
  </section>;
}
