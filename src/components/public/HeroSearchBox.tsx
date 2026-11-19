"use client";

import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, MapPin, FileText, ArrowRight, Loader2 } from "lucide-react";

export function HeroSearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [stream, setStream] = useState("all");
  const [pending, startTransition] = useTransition();
  const { results: suggestions, loading: searching, error: searchError } = useSearchSuggestions(query, true, stream);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const navigate = (href: string) => {
    setFocused(false);
    startTransition(() => router.push(href));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      if (stream !== "all") {
        navigate(`/colleges?stream=${encodeURIComponent(stream)}`);
      } else {
        navigate("/colleges");
      }
      return;
    }
    navigate(`/colleges?q=${encodeURIComponent(query.trim())}${stream !== "all" ? `&stream=${stream}` : ""}`);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-3xl mx-auto" onKeyDown={event => { if (event.key === "Escape") setFocused(false); }}>
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl p-2 sm:p-2.5 shadow-xl border border-slate-200 transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 flex flex-col sm:flex-row items-stretch gap-2"
      >
        <div className="flex-1 min-w-0 flex items-center px-3.5 py-2.5 gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            aria-label="Search colleges and blogs"
            autoComplete="off"
            onFocus={() => setFocused(true)}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setFocused(true); }}
            placeholder="Search colleges, cities, courses or blog topics…"
            className="w-full bg-transparent text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-3">
          <select
            aria-label="Course stream"
            value={stream}
            onChange={(e) => setStream(e.target.value)}
            className="bg-slate-100 text-xs sm:text-sm font-semibold text-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none cursor-pointer border-0"
          >
            <option value="all">All Courses</option>
            <option value="Engineering">Engineering</option>
            <option value="Management">Management</option>
            <option value="Medical">Medical</option>
          </select>

          <button
            type="submit"
            disabled={pending}
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-[#1a3068] hover:bg-[#152754] active:bg-[#0f1f45] transition-colors shadow-sm flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <span>{pending ? "Searching…" : "Search"}</span>
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </form>

      {focused && query.trim().length >= 2 && (
        <div className="absolute top-auto left-0 right-0 z-30 mt-2 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden text-left">
          {searching ? <p role="status" className="p-4 text-sm text-slate-500">Finding suggestions…</p> : suggestions.length ? (
            <ul aria-label="College and blog suggestions" className="divide-y divide-slate-100">
              {suggestions.map(college => <li key={college.id}>
                <Link href={college.href} onClick={() => setFocused(false)} className="block px-4 py-3 hover:bg-slate-50 focus:bg-slate-50">
                  <span className="block text-sm font-semibold text-slate-900">{college.title}</span>
                  <span className="mt-1 flex items-center gap-1 text-xs text-slate-500">{college.type === "college" ? <MapPin className="h-3 w-3" /> : <FileText className="h-3 w-3" />}{college.type === "college" ? "College" : "Blog"} · {college.subtitle}</span>
                </Link>
              </li>)}
            </ul>
          ) : <p role="status" className="p-4 text-sm text-slate-500">{searchError ? "Suggestions unavailable. Press Search to view results." : "No matching suggestions. Try another college, topic, or course."}</p>}
          <button type="button" onClick={handleSubmit} className="w-full border-t px-4 py-3 text-left text-sm font-semibold text-primary hover:bg-slate-50">View all college results <ArrowRight className="ml-1 inline h-4 w-4" /></button>
        </div>
      )}

      {/* Realistic Popular Searches */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mt-3.5 text-xs">
        <span className="text-slate-500 font-medium">Popular:</span>
        {[
          { label: "IIT Bombay", q: "IIT Bombay" },
          { label: "NIT Rourkela", q: "NIT Rourkela" },
          { label: "BITS Pilani", q: "BITS Pilani" },
          { label: "Top B.Tech Colleges", href: "/colleges/b-tech" },
          { label: "Top MBA Colleges", href: "/colleges/mba" },
        ].map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              if (item.href) {
                navigate(item.href);
              } else {
                navigate(`/colleges?q=${encodeURIComponent(item.q || "")}`);
              }
            }}
            className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-[#1a3068] hover:text-[#1a3068] transition-colors text-[11px] font-medium shadow-xs"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
