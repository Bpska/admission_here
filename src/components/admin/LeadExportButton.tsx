"use client";
import { useState } from "react";
import { Download } from "lucide-react";

export function LeadExportButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/v1/admin/enquiries?export=xlsx");
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || "Unable to export leads."); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url;
      link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || "admission-leads.xlsx";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to download leads. Please try again."); }
    finally { setLoading(false); }
  }
  return <div className="space-y-1"><button type="button" onClick={download} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border bg-background px-4 py-2 text-xs font-bold hover:bg-muted disabled:opacity-60"><Download className="w-4 h-4 text-emerald-600" />{loading ? "Preparing Excel…" : "Download all leads (Excel)"}</button>{error && <p role="alert" className="text-xs text-red-700">{error}</p>}</div>;
}
