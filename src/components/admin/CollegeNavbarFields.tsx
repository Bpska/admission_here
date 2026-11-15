"use client";

import { NAVBAR_CATEGORIES, NAVBAR_COLUMN_TITLES, type NavbarCategory } from "@/lib/navbar-categories";
import { NAVBAR_FILTERS, defaultNavbarFilter } from "@/lib/navbar-filters";

export function CollegeNavbarFields({ enabled, category, section, filter, onEnabledChange, onCategoryChange, onSectionChange, onFilterChange }: {
  enabled: boolean; category: string; section: string; filter: string;
  onEnabledChange: (value: boolean) => void; onCategoryChange: (value: string) => void;
  onSectionChange: (value: string) => void; onFilterChange: (value: string) => void;
}) {
  const choices = NAVBAR_FILTERS.filter(item => item.category === category && (section === "featured" || item.section === section));
  const selected = choices.some(item => item.id === filter) ? filter : choices[0]?.id || "";
  return <section className="rounded-2xl border bg-card p-6 space-y-4">
    <h2 className="text-sm font-bold">Navbar filter placement</h2>
    <label className="flex items-center gap-2 text-sm font-semibold">
      <input type="checkbox" checked={enabled} onChange={event => onEnabledChange(event.target.checked)} />
      Include this college in a navbar filter
    </label>
    <p className="text-xs text-muted-foreground">The menu shows the filter label. This college appears in its results after publication. Staff changes require admin approval.</p>
    {enabled && <>
      <label className="block space-y-1 text-xs font-semibold"><span>Navbar category *</span>
        <select aria-label="Navbar category" required value={category} onChange={event => {
          const value = event.target.value; onCategoryChange(value); onSectionChange("featured"); onFilterChange(defaultNavbarFilter(value)?.id || "");
        }} className="w-full rounded-lg border bg-background p-2.5">
          <option value="">Select a category</option>
          {NAVBAR_CATEGORIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      {category && <>
        <label className="block space-y-1 text-xs font-semibold"><span>Dropdown section *</span>
          <select aria-label="Dropdown section" value={section} onChange={event => { onSectionChange(event.target.value); onFilterChange(defaultNavbarFilter(category, event.target.value)?.id || ""); }} className="w-full rounded-lg border bg-background p-2.5">
            <option value="featured">All filter sections</option>
            {NAVBAR_COLUMN_TITLES[category as NavbarCategory]?.map((title, index) => NAVBAR_FILTERS.some(item => item.category === category && item.section === `column_${index + 1}`) && <option key={title} value={`column_${index + 1}`}>{title}</option>)}
          </select>
        </label>
        <label className="block space-y-1 text-xs font-semibold"><span>College filter *</span>
          <select aria-label="College filter" required value={selected} onChange={event => onFilterChange(event.target.value)} className="w-full rounded-lg border bg-background p-2.5">
            {choices.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <span className="block font-normal text-muted-foreground">Example: choose Top B.Tech Colleges in India to include this college in that results page.</span>
        </label>
      </>}
    </>}
  </section>;
}
