"use client";
import { useEffect, useState } from "react";
import type { SearchSuggestion } from "@/lib/search-suggestions";
export function useSearchSuggestions(query: string, enabled = true, stream = "all") {
  const [results, setResults] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setResults([]); setError(false);
    if (!enabled || query.trim().length < 2) { setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try { const response = await fetch(`/api/v1/search/suggestions?q=${encodeURIComponent(query.trim().slice(0, 100))}${stream !== "all" ? `&stream=${encodeURIComponent(stream)}` : ""}`, { signal: controller.signal }); if (!response.ok) throw Error("Search unavailable"); const data = await response.json(); if (!controller.signal.aborted) setResults(data.data || []); }
      catch { if (!controller.signal.aborted) setError(true); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, enabled, stream]);
  return { results, loading, error };
}
