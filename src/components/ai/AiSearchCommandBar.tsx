"use client";
import { useState, useEffect, useRef, useId } from "react";
import Link from "next/link";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import { useRouter } from "next/navigation";
import { Search, Building2, FileText, X } from "lucide-react";
interface AiSearchCommandBarProps { open: boolean; onOpenChange: (open: boolean) => void }
export function AiSearchCommandBar({ open, onOpenChange }: AiSearchCommandBarProps) {
  useScrollLock(open);
  const router = useRouter(); const id = useId();
  const [query, setQuery] = useState(""); const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null); const dialogRef = useRef<HTMLDivElement>(null);
  const { results, loading, error } = useSearchSuggestions(query, open);
  useEffect(() => { const handle = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key === "k") { event.preventDefault(); onOpenChange(!open); } if (event.key === "Escape" && open) onOpenChange(false); }; window.addEventListener("keydown", handle); return () => window.removeEventListener("keydown", handle); }, [open, onOpenChange]);
  useEffect(() => { if (!open) { setQuery(""); return; } const previous = document.activeElement as HTMLElement | null; const timer = setTimeout(() => inputRef.current?.focus(), 0); return () => { clearTimeout(timer); previous?.focus(); }; }, [open]);
  useEffect(() => setActive(-1), [query, results]);
  useEffect(() => { if (active >= 0) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" }); }, [active, id]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-3 pt-6 backdrop-blur-xs sm:pt-20" onClick={event => { if (event.target === event.currentTarget) onOpenChange(false); }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Search colleges and blogs" className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-background shadow-2xl" onKeyDown={event => {
      if (event.key === "Tab") { const elements = dialogRef.current?.querySelectorAll<HTMLElement>('input, button, a[href]'); const first = elements?.[0]; const last = elements?.[elements.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
    }}>
      <div className="flex shrink-0 items-center gap-3 border-b bg-muted/20 px-4 py-3"><Search className="h-5 w-5 text-muted-foreground" /><input ref={inputRef} role="combobox" aria-label="Search colleges and blogs" aria-autocomplete="list" aria-controls={id} aria-expanded={results.length > 0} aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined} maxLength={100} autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "ArrowDown" && results.length) { event.preventDefault(); setActive(value => (value + 1) % results.length); } if (event.key === "ArrowUp" && results.length) { event.preventDefault(); setActive(value => (value <= 0 ? results.length - 1 : value - 1)); } if (event.key === "Enter" && active >= 0 && results[active]) { event.preventDefault(); onOpenChange(false); router.push(results[active].href); } }} placeholder="Search colleges, cities, courses or blog articles…" className="min-w-0 flex-1 bg-transparent text-sm outline-hidden" /><button type="button" onClick={() => onOpenChange(false)} aria-label="Close search" className="rounded p-1 hover:bg-muted"><X className="h-5 w-5" /></button></div>
      <div className="max-h-[60vh] overflow-y-auto p-3">
        {loading ? <p role="status" className="p-4 text-sm text-muted-foreground">Finding suggestions…</p> : error ? <p role="alert" className="p-4 text-sm text-muted-foreground">Suggestions are unavailable. Please try again.</p> : query.trim().length >= 2 ? results.length ? <ul id={id} role="listbox" aria-label="Search suggestions" className="space-y-1">{results.map((result, index) => <li id={`${id}-${index}`} role="option" aria-selected={active === index} key={`${result.type}-${result.id}`}><Link href={result.href} onClick={() => onOpenChange(false)} onMouseEnter={() => setActive(index)} className={`flex items-start gap-3 rounded-lg p-3 hover:bg-muted ${active === index ? "bg-muted" : ""}`}>{result.type === "college" ? <Building2 className="mt-1 h-5 w-5 shrink-0 text-primary" /> : <FileText className="mt-1 h-5 w-5 shrink-0 text-primary" />}<span><span className="block text-sm font-semibold">{result.title}</span><span className="mt-1 block text-xs text-muted-foreground">{result.type === "college" ? "College" : "Blog"} · {result.subtitle}</span></span></Link></li>)}</ul> : <p role="status" className="p-4 text-sm text-muted-foreground">No matching colleges or articles. Try a different search.</p> : <p className="p-4 text-sm text-muted-foreground">Type at least two characters to see college and blog suggestions. Use ↑ ↓ and Enter to select a result.</p>}
      </div>
    </div>
  </div>;
}
