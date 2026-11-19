"use client";

import { useId, useRef, useState } from "react";

export function ImageUploadField({ label, values, onChange, multiple = false, purpose = "colleges", disabled = false, collectionLabel = "gallery", onBusyChange }: {
  label: string; values: string[]; onChange: (values: string[]) => void;
  multiple?: boolean; purpose?: "colleges" | "blogs"; disabled?: boolean;
  collectionLabel?: string;
  onBusyChange: (busy: boolean) => void;
}) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(files: File[]) {
    if (!files.length || busy) return;
    if (files.length > 10 || files.some(file => file.size > 3 * 1024 * 1024 || !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type))) {
      setError("Choose up to 10 JPEG, PNG, GIF or WebP images, each 3 MB or smaller."); return;
    }
    setBusy(true); onBusyChange(true); setError("");
    const uploaded: string[] = [];
    let failed = 0;
    try {
      for (const file of files) {
        try {
          const form = new FormData(); form.append("file", file);
          const response = await fetch(`/api/v1/cms/blog-images?purpose=${purpose}`, { method: "POST", body: form });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Upload failed");
          uploaded.push(data.url);
        } catch { failed++; }
      }
      if (uploaded.length) onChange(multiple ? [...values, ...uploaded] : uploaded.slice(-1));
      if (failed) setError(`${failed} image(s) could not be uploaded. Please select those files again.`);
    } finally { setBusy(false); onBusyChange(false); }
  }
  return <div className="space-y-2">
    <label htmlFor={id} className="block text-xs font-semibold text-muted-foreground">{label}</label>
    <input ref={fileInput} id={id} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple={multiple} disabled={disabled || busy} className="sr-only" onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ""; void upload(files); }} />
    <button type="button" disabled={disabled || busy} onClick={() => fileInput.current?.click()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
      {busy ? "Uploading…" : multiple ? (values.length ? `Add more ${collectionLabel} photos` : `Upload ${collectionLabel} photos`) : (values.length ? "Replace image" : "Upload image")}
    </button>
    {multiple && <p className="text-xs text-muted-foreground">Select multiple photos together, or add them in separate uploads. New photos are added to this collection.</p>}
    {multiple && values.length > 0 && <p role="status" className="text-xs font-semibold">{values.length} {values.length === 1 ? "photo" : "photos"} in this collection. Save changes to apply your photos.</p>}
    <p className="text-xs text-muted-foreground">JPEG, PNG, GIF or WebP · Up to 3 MB per image{multiple ? " · Select up to 10 at once" : ""}</p>
    {busy && <p role="status" className="text-xs">Uploading images…</p>}
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    <div className="flex flex-wrap gap-3">{values.map((url, index) => <div key={`${url}-${index}`} className="space-y-1 rounded-lg border p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`${label} preview ${index + 1}`} className="h-24 w-32 object-contain" />
      <button type="button" disabled={disabled || busy} onClick={() => onChange(values.filter((_, position) => position !== index))} className="text-xs text-red-600">Remove image {multiple ? index + 1 : ""}</button>
    </div>)}</div>
  </div>;
}
