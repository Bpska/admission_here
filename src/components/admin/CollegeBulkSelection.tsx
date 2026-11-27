"use client";

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

type Selection = {
  selected: Set<string>;
  busy: boolean;
  toggle: (id: string) => void;
};
const SelectionContext = createContext<Selection | null>(null);

export function CollegeSelectionCheckbox({ id, name }: { id: string; name: string }) {
  const selection = useContext(SelectionContext);
  if (!selection) return null;
  return (
    <input
      type="checkbox"
      aria-label={`Select ${name}`}
      checked={selection.selected.has(id)}
      disabled={selection.busy}
      onChange={() => selection.toggle(id)}
      className="h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:cursor-wait"
    />
  );
}

export function CollegeBulkSelection({
  ids,
  enabled,
  children,
}: {
  ids: string[];
  enabled: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selectAll = useRef<HTMLInputElement>(null);
  const selected = useMemo(() => new Set(ids.filter(id => checked.has(id))), [ids, checked]);
  const allSelected = ids.length > 0 && selected.size === ids.length;
  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = selected.size > 0 && !allSelected;
  }, [selected.size, allSelected]);

  const toggle = (id: string) => {
    setChecked(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setError("");
    setNotice("");
  };

  const deleteSelected = async () => {
    if (busy || !selected.size) return;
    const collegeIds = [...selected];
    if (!window.confirm(
      `Permanently delete ${collegeIds.length} selected college(s)?\n\nTheir course mappings, statistics, reviews and college approval requests will also be removed. Student leads and blog articles will be retained without their college link.\n\nThis cannot be undone.`,
    )) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/v1/cms/colleges", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: collegeIds, confirm: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete the selected colleges.");
      setChecked(new Set());
      setNotice(`${data.deletedCount} college(s) deleted successfully.`);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not delete the selected colleges.");
    } finally {
      setBusy(false);
    }
  };

  if (!enabled) return <>{children}</>;
  return (
    <SelectionContext.Provider value={{ selected, busy, toggle }}>
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/10 p-4 text-sm">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
          <input
            ref={selectAll}
            type="checkbox"
            checked={allSelected}
            disabled={busy || ids.length === 0}
            onChange={() => {
              setChecked(allSelected ? new Set() : new Set(ids));
              setError("");
              setNotice("");
            }}
            className="h-4 w-4 accent-primary"
          />
          Select all colleges ({ids.length})
        </label>
        <span aria-live="polite" className="text-muted-foreground">{selected.size} selected</span>
        {selected.size > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setChecked(new Set())}
            className="min-h-11 px-2 font-semibold underline disabled:opacity-50"
          >
            Clear selection
          </button>
        )}
        <button
          type="button"
          onClick={deleteSelected}
          disabled={busy || selected.size === 0}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto"
        >
          <Trash2 className="h-4 w-4" />
          {busy ? "Deleting colleges…" : `Delete selected (${selected.size})`}
        </button>
      </div>
      {error && <p role="alert" className="break-words border-b bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="border-b bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
      {children}
    </SelectionContext.Provider>
  );
}
