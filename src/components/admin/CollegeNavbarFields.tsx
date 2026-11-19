"use client";

import { useEffect, useState } from "react";
import { NAVBAR_CATEGORIES, NAVBAR_COLUMN_TITLES, type NavbarCategory } from "@/lib/navbar-categories";
import { NAVBAR_FILTERS, type NavbarFilterOption } from "@/lib/navbar-filters";

export function CollegeNavbarFields({ enabled, category, section, filter, onEnabledChange, onCategoryChange, onSectionChange, onFilterChange, formId }: {
  formId?: string;
  enabled: boolean; category: string; section: string; filter: string;
  onEnabledChange: (value: boolean) => void; onCategoryChange: (value: string) => void;
  onSectionChange: (value: string) => void; onFilterChange: (value: string) => void;
}) {
  const [options, setOptions] = useState<NavbarFilterOption[]>(NAVBAR_FILTERS);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/v1/cms/navbar-filters").then(async response => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Unable to load saved sections.");
      if (active) setOptions(data.filters);
    }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, []);
  const selected = options.find(item => item.id === filter);
  useEffect(() => { if (selected) setQuery(selected.label); }, [selected?.id, selected?.label]);
  const choices = options.filter(item => item.category === category && item.label.toLowerCase().includes(query.trim().toLowerCase()));
  const exact = options.find(item => item.category === category && item.label.toLowerCase() === query.trim().replace(/\s+/g, " ").toLowerCase());
  function select(option: NavbarFilterOption) {
    onCategoryChange(option.category); onSectionChange(option.section); onFilterChange(option.id);
    setQuery(option.label); setError("");
  }
  async function saveSection() {
    if (saving) return;
    if (exact) { select(exact); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/v1/cms/navbar-filters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: query, category, section: section === "featured" ? "column_1" : section }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Unable to save section.");
      setOptions(previous => [...previous.filter(item => item.id !== data.filter.id), data.filter]);
      select(data.filter);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save section."); }
    finally { setSaving(false); }
  }
  return <section className="rounded-2xl border bg-card p-6 space-y-4">
    <h2 className="text-sm font-bold">Navbar filter placement</h2>
    <label className="flex items-center gap-2 text-sm font-semibold"><input form={formId} type="checkbox" checked={enabled} onChange={event => onEnabledChange(event.target.checked)} />Include this college in a navbar filter</label>
    <p className="text-xs text-muted-foreground">Choose a category, then type a section name. Select an existing match or save a new section for reuse. It becomes public when a published college is assigned to it. Staff college changes require admin approval.</p>
    {enabled && <>
      <label className="block space-y-1 text-xs font-semibold"><span>Navbar category *</span>
        <select form={formId} aria-label="Navbar category" required disabled={saving} value={category} onChange={event => { onCategoryChange(event.target.value); onSectionChange("column_1"); onFilterChange(""); setQuery(""); setError(""); }} className="w-full rounded-lg border bg-background p-2.5">
          <option value="">Select a category</option>{NAVBAR_CATEGORIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      {category && <>
        <label className="block space-y-1 text-xs font-semibold"><span>Menu column for a new section</span>
          <select form={formId} aria-label="Dropdown section" disabled={saving} value={section === "featured" ? "column_1" : section} onChange={event => { onSectionChange(event.target.value); onFilterChange(""); }} className="w-full rounded-lg border bg-background p-2.5">
            {NAVBAR_COLUMN_TITLES[category as NavbarCategory]?.map((title, index) => <option key={title} value={`column_${index + 1}`}>{title}</option>)}
          </select>
        </label>
        <label className="block space-y-1 text-xs font-semibold"><span>Section / filter name *</span>
          <input form={formId} aria-label="Section or filter name" required disabled={saving} maxLength={120} value={query} onChange={event => { setQuery(event.target.value); onFilterChange(""); setError(""); }} placeholder="Type a section, e.g. Engineering Colleges in Bhubaneswar" className="w-full rounded-lg border bg-background p-2.5" />
        </label>
        {!selected && <div className="space-y-2">
          {choices.length > 0 && <ul aria-label="Matching sections" className="max-h-52 overflow-y-auto rounded-lg border divide-y">{choices.map(item => <li key={item.id}><button type="button" disabled={saving} onClick={() => select(item)} className="w-full px-3 py-2 text-left text-sm hover:bg-accent"><span className="font-semibold">{item.label}</span><span className="ml-2 text-xs text-muted-foreground">{item.sectionLabel}</span></button></li>)}</ul>}
          {query.trim().length >= 2 && <button type="button" disabled={saving} onClick={saveSection} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{saving ? "Saving section…" : exact ? `Select “${exact.label}”` : `Save “${query.trim()}” as a new section`}</button>}
        </div>}
        <input form={formId} aria-label="Selected navbar section" tabIndex={-1} className="sr-only" required value={filter} onChange={() => {}} title="Select a matching section or save a new section first." />
        {selected && <p role="status" className="text-sm text-emerald-700">Selected: {selected.label}{selected.custom && <> · Section page: {selected.href}</>}</p>}
      </>}
    </>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </section>;
}
