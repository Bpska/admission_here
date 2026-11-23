"use client";

import { ActionAuthGate, redirectIfUnauthorized } from "@/components/auth/SignInPrompt";
import { useEffect, useState } from "react";
import { X, CheckCircle2, FileText, Download } from "lucide-react";
import { LeadCtaType } from "@prisma/client";
import { useScrollLock } from "@/hooks/useScrollLock";
import type { CollegeBrochure } from "@/lib/brochures";
import { INDIAN_STATES, getDistricts, isValidStateDistrict } from "@/lib/india-locations";

interface Props { open: boolean; onClose: () => void; collegeId: string; collegeName: string; blogId?: string }
const fieldClass = "w-full min-w-0 px-3 py-2.5 text-sm border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60";

export function BrochureDownloadModal({ open, onClose, collegeId, collegeName, blogId }: Props) {
  useScrollLock(open);
  const [brochures, setBrochures] = useState<CollegeBrochure[]>([]);
  const [websiteUrl, setWebsiteUrl] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [retry, setRetry] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [targetCourse, setTargetCourse] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const courses = Array.from(new Set(brochures.flatMap(item => item.programs)));
  const course = courses.includes(targetCourse) ? targetCourse : courses[0] || "";
  const selected = brochures.filter(item => item.programs.includes(course))
    .sort((a, b) => b.year.localeCompare(a.year))[0];
  const year = selected?.year;
  const storageKey = `admission_brochure_${collegeId}_${selected?.id || ""}`;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setFetching(true); setFetchError(""); setBrochures([]); setWebsiteUrl(null);
    fetch(`/api/v1/colleges/${collegeId}/brochures`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Unable to load brochures. Please try again.");
        return response.json();
      })
      .then(data => { setBrochures(data.brochures); setWebsiteUrl(data.websiteUrl); })
      .catch(error => { if (!controller.signal.aborted) setFetchError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setFetching(false); });
    return () => controller.abort();
  }, [open, collegeId, retry]);

  useEffect(() => {
    if (!open) return;
    setError("");
    try { setUnlocked(Boolean(localStorage.getItem(storageKey))); }
    catch { setUnlocked(false); }
  }, [open, storageKey]);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading || !selected) return;
    if (!isValidStateDistrict(state, district)) { setError("Select a district belonging to your chosen state."); return; }
    const validPhone = (value: string) => /^(?:\+91|91|0)?[6-9]\d{9}$/.test(value.replace(/[\s()-]/g, ""));
    if (!validPhone(phone) || !validPhone(parentPhone)) { setError("Enter valid Indian mobile numbers for you and your parent or guardian."); return; }
    if (name.trim().length < 2) { setError("Enter your full name."); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/v1/leads/capture", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName: name.trim(), phone: phone.trim(), email: email.trim(), state, district,
          parentPhone: parentPhone.trim(), targetCourse: course, targetStream: course,
          targetCollegeId: collegeId, brochureId: selected.id, sourceUrl: window.location.pathname,
          sourceBlogId: blogId && blogId !== "preview-id" ? blogId : undefined,
          ctaType: LeadCtaType.DOWNLOAD_BROCHURE }),
      });
      if (redirectIfUnauthorized(response)) return;
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to submit your details.");
      try { localStorage.setItem(storageKey, JSON.stringify({ submittedAt: new Date().toISOString() })); }
      catch { /* Downloads still work without browser storage. */ }
      setUnlocked(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Please check your connection and try again."); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <section role="dialog" aria-modal="true" aria-labelledby={`brochure-title-${collegeId}`} className="w-full max-w-lg bg-background rounded-2xl shadow-2xl border max-h-[92dvh] overflow-hidden flex flex-col">
        <div className="p-4 sm:p-5 border-b flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0"><p className="text-xs font-bold text-primary flex items-center gap-2 mb-1"><FileText className="w-4 h-4" />Official admission documents</p><h3 id={`brochure-title-${collegeId}`} className="font-extrabold text-base break-words">Brochures: {collegeName}</h3></div>
          <button type="button" onClick={onClose} aria-label="Close brochure dialog" className="p-1 shrink-0"><X className="w-5 h-5" /></button>
        </div>
        <ActionAuthGate message="Sign in before requesting a college brochure.">
        <div className="p-4 sm:p-6 min-h-0 overflow-y-auto overscroll-contain space-y-4">
          {fetching ? <p role="status" className="text-sm text-muted-foreground">Loading official documents…</p> : fetchError ? (
            <div role="alert" className="text-sm space-y-2"><p>{fetchError}</p><button type="button" className="underline text-primary" onClick={() => setRetry(value => value + 1)}>Try again</button></div>
          ) : !selected ? (
            <div className="rounded-xl border bg-muted/40 p-4 space-y-2 text-sm"><p className="font-semibold">No verified brochure available yet</p><p className="text-muted-foreground">Check the college website for admission updates.</p>{websiteUrl && <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-primary underline">Visit official college website</a>}</div>
          ) : <>
            {unlocked ? (
              <div className="text-center py-4 space-y-4"><CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" /><h4 className="font-bold">Your document is ready</h4><p className="text-sm text-muted-foreground">{selected.title} · {year}</p><a href={selected.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 bg-primary text-primary-foreground text-sm font-bold"><Download className="w-4 h-4" />Open official document</a><button type="button" className="block mx-auto text-xs underline text-muted-foreground" onClick={() => setUnlocked(false)}>Update my details</button></div>
            ) : <form onSubmit={handleSubmit} className="space-y-3.5">
              <p className="text-xs text-muted-foreground">Complete your details to continue to the selected {year} document.</p>
              {error && <p role="alert" className="text-xs text-red-600 bg-red-500/10 p-3 rounded-lg">{error}</p>}
              <fieldset disabled={loading} className="space-y-3.5">
                <label className="block text-xs font-bold space-y-1"><span>Full name *</span><input className={fieldClass} required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={event => setName(event.target.value)} /></label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-xs font-bold space-y-1"><span>Contact number *</span><input className={fieldClass} type="tel" autoComplete="tel" required value={phone} onChange={event => setPhone(event.target.value)} /></label>
                  <label className="block text-xs font-bold space-y-1"><span>Email address *</span><input className={fieldClass} type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-xs font-bold space-y-1"><span>State / union territory *</span><select aria-label="State / union territory" className={fieldClass} required value={state} onChange={event => { setState(event.target.value); setDistrict(""); }}><option value="">Select state / UT</option>{INDIAN_STATES.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                  <label className="block text-xs font-bold space-y-1"><span>District *</span><select aria-label="District" className={fieldClass} required disabled={!state} value={district} onChange={event => setDistrict(event.target.value)}><option value="">{state ? "Select district" : "Select a state first"}</option>{getDistricts(state).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                </div>
                <label className="block text-xs font-bold space-y-1"><span>Target course *</span><select aria-label="Target course" className={fieldClass} required value={course} onChange={event => setTargetCourse(event.target.value)}>{courses.map(program => <option key={program} value={program}>{program}</option>)}</select></label>
                <label className="block text-xs font-bold space-y-1"><span>Parent / guardian contact number *</span><input className={fieldClass} type="tel" required value={parentPhone} onChange={event => setParentPhone(event.target.value)} /></label>
                <button type="submit" className="w-full rounded-xl bg-primary text-primary-foreground px-4 py-3 text-sm font-bold disabled:opacity-60">{loading ? "Submitting…" : "Submit & continue to document"}</button>
              </fieldset>
              <p className="text-[10px] text-center text-muted-foreground">Your details are used for admissions counseling communication.</p>
            </form>}
          </>}
        </div>
        </ActionAuthGate>
      </section>
    </div>
  );
}
