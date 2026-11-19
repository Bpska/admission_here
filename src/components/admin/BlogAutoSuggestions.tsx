"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import type { BlogDraft } from "@/lib/blog-draft";
import { RichBlogRenderer } from "@/components/blog/RichBlogRenderer";
export function BlogAutoSuggestions({ title, collegeSlugs, disabled, hasContent, onApply, onBusyChange }: { title: string; collegeSlugs: string[]; disabled: boolean; hasContent: boolean; onApply: (draft: BlogDraft) => void; onBusyChange: (value: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ draft: BlogDraft; mode: "starter" | "ai"; message: string } | null>(null);
  const [error, setError] = useState(""); const [applied, setApplied] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const key = JSON.stringify([title, collegeSlugs]);
  useEffect(() => { controller.current?.abort(); setBusy(false); onBusyChange(false); setResult(null); setError(""); setApplied(false); return () => controller.current?.abort(); }, [key, onBusyChange]);
  async function generate() {
    const request = new AbortController(); controller.current = request;
    setBusy(true); onBusyChange(true); setError(""); setResult(null); setApplied(false);
    try {
      const response = await fetch("/api/v1/cms/blogs/generate", { method: "POST", signal: request.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), collegeSlugs }) });
      const data = await response.json(); if (!response.ok) throw Error(data.error || "Unable to generate a draft.");
      if (!request.signal.aborted) setResult(data);
    } catch (error) { if (!request.signal.aborted) setError(error instanceof Error ? error.message : "Unable to generate a draft."); }
    finally { if (!request.signal.aborted) { setBusy(false); onBusyChange(false); } }
  }
  return <section className="space-y-4 rounded-xl border bg-card p-5">
    <h2 className="flex items-center gap-2 text-sm font-bold"><Sparkles className="h-4 w-4 text-primary" />Write from a title</h2>
    <p className="text-xs text-muted-foreground">Enter the article title, then generate the article text, SEO title, description, tags, category and FAQs. Nothing is saved or published automatically.</p>
    <button type="button" disabled={busy || disabled || title.trim().length < 3 || title.trim().length > 180} onClick={() => void generate()} className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Writing your draft…" : "Generate from title"}</button>
    {title.trim().length < 3 && <p className="text-xs text-muted-foreground">Type an article title above to begin.</p>}
    {title.trim().length > 180 && <p className="text-xs text-amber-700">Shorten the title to 180 characters or fewer to generate a draft.</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {result && <div className="space-y-3">
      <p role="status" className="text-xs text-muted-foreground">{result.message}</p>
      <p className="text-xs font-semibold">{result.mode === "ai" ? "AI draft" : "Starter draft"} · {result.draft.faqs.length} FAQs · {result.draft.tags.length} tags</p>
      <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">Preview generated draft</summary><div className="mt-3 max-h-96 space-y-3 overflow-auto text-sm"><h3 className="font-bold">{result.draft.title}</h3><RichBlogRenderer content={result.draft.contentHtml} blogId="generated-draft-preview" /><p><strong>SEO title:</strong> {result.draft.metaTitle}</p><p><strong>Description:</strong> {result.draft.metaDescription}</p><p><strong>Tags:</strong> {result.draft.tags.join(", ")}</p>{result.draft.faqs.map((faq, index) => <div key={index}><strong>{faq.question}</strong><p>{faq.answer}</p></div>)}</div></details>
      <button type="button" disabled={disabled || applied} onClick={() => { onApply(result.draft); setApplied(true); }} className="w-full rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50">{applied ? "Draft added to editor" : hasContent ? "Use draft — replace current text and SEO fields" : "Use draft in editor"}</button>
      {applied && <p className="text-xs text-emerald-700">Review the editor, then save as draft or publish when ready.</p>}
    </div>}
  </section>;
}
