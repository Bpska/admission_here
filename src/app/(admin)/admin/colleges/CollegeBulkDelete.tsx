"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { bulkDeleteLimit } from "@/lib/college-bulk-delete-limit";

const Selection = createContext<{
  selected: Set<string>;
  toggle: (id: string) => void;
  busy: boolean;
} | null>(null);

export function CollegeDeleteCheckbox({ id, name }: { id: string; name: string }) {
  const selection = useContext(Selection);
  if (!selection) return null;
  const checked = selection.selected.has(id);
  return (
    <input
      type="checkbox"
      aria-label={`Select ${name} for deletion`}
      className="h-4 w-4 shrink-0"
      checked={checked}
      disabled={selection.busy || (!checked && selection.selected.size >= bulkDeleteLimit)}
      onChange={() => selection.toggle(id)}
    />
  );
}

export function CollegeBulkDelete({ ids, children }: { ids: string[]; children: ReactNode }) {
  const router = useRouter();
  const [selection, setSelection] = useState(new Set<string>());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const selected = new Set(ids.filter((id) => selection.has(id)));
  const count = selected.size;
  const group = ids.slice(0, bulkDeleteLimit);
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < bulkDeleteLimit) next.add(id);
    setSelection(next);
  };

  async function removeSelected() {
    if (busy || !count ||
        !window.confirm(`Permanently delete ${count} selected college${count === 1 ? "" : "s"} and their associated records? This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/v1/cms/colleges/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], confirm: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Bulk deletion could not be completed.");
      setSelection(new Set());
      setStatus(`${result.deleted} deleted.${result.missing ? ` ${result.missing} already absent.` : ""}`);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Bulk deletion could not be completed.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Selection.Provider value={{ selected, toggle, busy }}>
      <div className="flex flex-wrap items-center gap-2 border-b p-4 text-sm">
        <button type="button" className="rounded-lg border px-3 py-2" disabled={busy || !ids.length}
          onClick={() => setSelection(new Set(group))}>
          {ids.length > bulkDeleteLimit ? `Select first ${bulkDeleteLimit}` : "Select all"}
        </button>
        {count > 0 && (
          <button type="button" className="px-2 py-2 underline" disabled={busy}
            onClick={() => setSelection(new Set())}>Clear selection</button>
        )}
        <button type="button" disabled={busy || !count} onClick={removeSelected}
          className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 font-semibold text-red-700 disabled:opacity-50">
          <Trash2 className="h-4 w-4" /> {busy ? "Deleting…" : `Delete selected${count ? ` (${count})` : ""}`}
        </button>
        {status && <span role="status">{status}</span>}
        {error && <span role="alert" className="text-red-700">{error}</span>}
      </div>
      {children}
    </Selection.Provider>
  );
}
