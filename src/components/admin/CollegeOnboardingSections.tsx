"use client";
import { RichTextEditor } from "./RichTextEditor";
import { ImageUploadField } from "./ImageUploadField";
import { useEffect, useState } from "react";
import { ADMIN_RESOURCES } from "@/lib/admin-data-config";

export type OnboardingDraft = Record<"offerings" | "cutoffs" | "placements" | "rankings", Record<string, any>[]>;
export const emptyOnboardingDraft = (): OnboardingDraft => ({ offerings: [], cutoffs: [], placements: [], rankings: [] });

export function serializeOnboarding(draft: OnboardingDraft) {
  return Object.fromEntries(Object.entries(draft).map(([resource, rows]) => [resource, rows.map(row => {
    const result: Record<string, any> = resource === "offerings" ? { clientId: row.clientId } : {};
    for (const field of ADMIN_RESOURCES[resource].fields) {
      const value = row[field.key] ?? "";
      result[field.key] = field.type === "images" ? (Array.isArray(value) ? value : []) : field.type === "number" ? (value === "" ? null : Number(value))
        : field.type === "list" ? String(value).split(",").map(item => item.trim()).filter(Boolean)
        : value === "" && !field.required ? null : value;
    }
    return result;
  })]));
}

export function CollegeOnboardingSections({ value, onChange, disabled, onBusyChange }: { value: OnboardingDraft; onChange: (value: OnboardingDraft) => void; disabled: boolean; onBusyChange?: (busy: boolean) => void }) {
  const [uploads, setUploads] = useState(0);
  const busy = disabled || uploads > 0;
  const onUploadBusy = (uploading: boolean) => { setUploads(count => count + (uploading ? 1 : -1)); onBusyChange?.(uploading); };
  const [options, setOptions] = useState<Record<string, any[]>>({});
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    fetch("/api/v1/cms/college-options").then(async response => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Unable to load courses and exams.");
      if (active) setOptions(data);
    }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [attempt]);
  function update(resource: keyof OnboardingDraft, index: number, key: string, next: string | string[]) {
    onChange({ ...value, [resource]: value[resource].map((row, position) => position === index ? { ...row, [key]: next } : row) });
  }
  return <>
    {error && <div role="alert" className="rounded-lg border p-3 text-sm text-red-700">{error} <button type="button" className="underline" onClick={() => setAttempt(attempt + 1)}>Retry</button></div>}
    {(["offerings", "cutoffs", "placements", "rankings"] as const).map(resource => <section key={resource} id={`college-${resource}`} className="scroll-mt-6 space-y-4 rounded-2xl border bg-card p-6">
      <div className="flex flex-wrap justify-between gap-3"><h2 className="text-lg font-bold">{ADMIN_RESOURCES[resource].label}</h2><button type="button" disabled={busy} className="rounded-lg border px-3 py-2 text-xs text-primary" onClick={() => onChange({ ...value, [resource]: [...value[resource], { clientId: crypto.randomUUID(), ...Object.fromEntries(ADMIN_RESOURCES[resource].fields.map(field => [field.key, field.options?.[0] || ""])) }] })}>Add {resource === "offerings" ? "course" : "record"}</button></div>
      {resource === "offerings" && <p className="text-xs text-muted-foreground">Type the course name, degree, stream, duration, eligibility and fee details directly. These records are stored when you save the college. Amounts are in rupees.</p>}
      {resource === "cutoffs" && <p className="text-xs text-muted-foreground">Add courses above first. Choose the course, entrance exam, year, category and counselling round for each cutoff.</p>}
      {value[resource].length === 0 && <p className="text-sm text-muted-foreground">No records added. This section is optional.</p>}
      {value[resource].map((row, index) => <div key={row.clientId} className="space-y-3 rounded-xl border p-4">
        <div className="flex justify-between"><h3 className="text-sm font-semibold">{resource === "offerings" ? "Course" : "Record"} {index + 1}</h3><button type="button" disabled={busy} className="text-xs text-red-600" onClick={() => {
          const next = { ...value, [resource]: value[resource].filter((_, position) => position !== index) };
          if (resource === "offerings") next.cutoffs = next.cutoffs.filter(cutoff => cutoff.collegeCourseId !== row.clientId);
          onChange(next);
        }}>Remove</button></div>
        <div className="grid gap-3 sm:grid-cols-2">{ADMIN_RESOURCES[resource].fields.map(field => {
          const id = `${resource}-${row.clientId}-${field.key}`;
          const common = { id, value: row[field.key] ?? "", required: field.required, disabled: busy, className: "w-full rounded-lg border bg-background p-2 text-sm" };
          const choices = field.reference === "offerings" ? value.offerings.map(offering => ({ id: offering.clientId, name: `${offering.degree || options.courses?.find(course => course.id === offering.courseId)?.degree || "Course"} — ${offering.specialization || "New specialization"}` })) : options[field.reference || ""] || [];
          return <div key={field.key} className={`space-y-1 ${["textarea", "images", "richtext"].includes(field.type || "") ? "sm:col-span-2" : ""}`}><label htmlFor={id} className="block text-xs font-semibold">{field.label}{field.required ? " *" : ""}</label>
            {field.type === "richtext" ? <RichTextEditor label={field.label} value={String(row[field.key] || "")} onChange={text => update(resource, index, field.key, text)} disabled={busy} /> : field.type === "images" ? <ImageUploadField label={field.label} collectionLabel="placement" multiple values={Array.isArray(row[field.key]) ? row[field.key] : []} onChange={values => update(resource, index, field.key, values)} disabled={busy} onBusyChange={onUploadBusy} /> : field.type === "select" ? <select {...common} onChange={event => update(resource, index, field.key, event.target.value)}><option value="">Select an option</option>{field.reference ? choices.map(option => <option key={option.id} value={option.id}>{option.name || option.fullName}</option>) : field.options?.map(option => <option key={option} value={option}>{option}</option>)}</select>
              : field.type === "textarea" ? <textarea {...common} rows={3} onChange={event => update(resource, index, field.key, event.target.value)} />
                : <input {...common} type={field.type === "number" ? "number" : "text"} min={field.min} max={field.max} step={field.step || (field.type === "number" ? "1" : undefined)} onChange={event => update(resource, index, field.key, event.target.value)} />}
          </div>;
        })}</div>
      </div>)}
    </section>)}
  </>;
}
