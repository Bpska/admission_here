"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const ratings = { ratingOverall: "Overall", ratingPlacements: "Placements", ratingInfra: "Infrastructure", ratingFaculty: "Faculty", ratingValueRoi: "Value for money" };
const control = "block w-full rounded-lg border bg-background p-2.5 text-sm";
export function StudentReviewForm({ collegeId }: { collegeId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<any>({ title: "", courseName: "", batchYear: new Date().getFullYear(), prosText: "", consText: "", ratingOverall: 5, ratingPlacements: 5, ratingInfra: 5, ratingFaculty: 5, ratingValueRoi: 5 });
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/student", { signal: controller.signal }).then(async response => { if (!response.ok) throw new Error("Unable to load your review."); return response.json(); }).then(data => { const previous = data.reviews.find((review: any) => review.collegeId === collegeId); if (previous) setForm(previous); }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [collegeId]);
  const update = (key: string, value: string | number) => setForm((previous: any) => ({ ...previous, [key]: value }));
  return <form className="border rounded-xl p-5 bg-card space-y-4" onSubmit={async event => { event.preventDefault(); setBusy(true); setError(""); setMessage(""); try { const response = await fetch("/api/v1/student/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, collegeId, batchYear: Number(form.batchYear) }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setMessage(data.message); router.refresh(); } catch (error) { setError(error instanceof Error ? error.message : "Unable to submit your review"); } finally { setBusy(false); } }}>
    <h3 className="text-lg font-bold">Write or update your review</h3><p className="text-xs text-muted-foreground">Share your own campus experience. New reviews and edits are checked before publication.</p>
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <fieldset disabled={busy} className="space-y-4">
      <label className="block text-sm">Review title<input aria-label="Review title" className={control} required minLength={3} maxLength={150} value={form.title} onChange={event => update("title", event.target.value)} /></label>
      <div className="grid sm:grid-cols-2 gap-4"><label className="text-sm">Course<input aria-label="Review course" className={control} required minLength={2} maxLength={150} value={form.courseName} onChange={event => update("courseName", event.target.value)} /></label><label className="text-sm">Graduation year<input aria-label="Graduation year" className={control} type="number" required min="1950" max={new Date().getFullYear() + 10} value={form.batchYear} onChange={event => update("batchYear", event.target.value)} /></label></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{Object.entries(ratings).map(([key, label]) => <label key={key} className="text-xs">{label}<select aria-label={`${label} rating`} className={control} value={form[key]} onChange={event => update(key, Number(event.target.value))}>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} / 5</option>)}</select></label>)}</div>
      <label className="block text-sm">What you liked<textarea aria-label="Review positives" className={control} required minLength={10} maxLength={5000} rows={3} value={form.prosText} onChange={event => update("prosText", event.target.value)} /></label>
      <label className="block text-sm">What could improve<textarea aria-label="Review improvements" className={control} required minLength={10} maxLength={5000} rows={3} value={form.consText} onChange={event => update("consText", event.target.value)} /></label>
      <button disabled={busy} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold">{busy ? "Submitting…" : "Submit review for moderation"}</button>
    </fieldset>
  </form>;
}
