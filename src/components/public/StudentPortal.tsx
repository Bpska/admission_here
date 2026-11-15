"use client";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { INDIAN_STATES } from "@/lib/india-locations";

const control = "block w-full rounded-lg border bg-background p-2.5 text-sm";
export function StudentPortal() {
  const [data, setData] = useState<any>(null);
  const [draft, setDraft] = useState<any>(null);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false); const [retry, setRetry] = useState(0);
  const [tab, setTab] = useState("applications");
  useEffect(() => {
    const controller = new AbortController(); setError("");
    fetch("/api/v1/student", { signal: controller.signal }).then(async response => { const json = await response.json(); if (!response.ok) throw new Error(json.error); return json; }).then(json => {
      setData(json); const profile = json.profile, scores = profile.examScores || {};
      setDraft({ name: profile.name, phone: profile.phone || "", targetStream: profile.targetStream || "", entranceExam: scores.entranceExam || "jee-main", rank: scores.rank ?? scores.jee_main_rank ?? "", category: scores.category || "GEN", homeState: scores.homeState || scores.home_state || "" });
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [retry]);
  const field = (key: string, value: string) => setDraft((previous: any) => ({ ...previous, [key]: value }));
  const statuses: Record<string, string> = { NEW: "Received", OTP_VERIFIED: "Contact verified", ASSIGNED_TO_COUNSELOR: "Counselor assigned", CONTACTED: "Contacted", APPLICATION_SUBMITTED: "Application submitted", ENROLLED: "Enrolled", INVALID: "Closed" };
  return <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
    <div className="flex flex-wrap justify-between items-center gap-3"><div><h1 className="text-2xl font-bold">My student portal</h1><p className="text-sm text-muted-foreground">{data ? `Welcome, ${data.profile.name}` : "Your applications, reviews and admissions profile"}</p></div><button type="button" className="border px-4 py-2 rounded-lg text-sm" onClick={() => signOut({ callbackUrl: "/login?callbackUrl=%2Fstudent" })}>Sign out</button></div>
    <nav className="flex flex-wrap gap-2">{["applications", "profile", "reviews"].map(value => <button key={value} type="button" aria-pressed={tab === value} className={`border rounded-lg px-4 py-2 text-sm capitalize ${tab === value ? "bg-primary text-primary-foreground" : "bg-card"}`} onClick={() => { setTab(value); setMessage(""); }}>{value === "applications" ? "My applications" : value === "reviews" ? "My reviews" : "My profile"}</button>)}<Link className="border rounded-lg px-4 py-2 text-sm" href="/colleges">Explore colleges</Link><Link className="border rounded-lg px-4 py-2 text-sm" href="/college-predictor/jee-main">College predictor</Link></nav>
    {error && <div role="alert" className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error} <button type="button" onClick={() => setRetry(value => value + 1)} className="underline">Retry</button></div>}
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    {!data ? <p role="status">Loading your portal…</p> : <>
      {tab === "applications" && <section className="space-y-4"><h2 className="font-bold text-lg">Your applications and brochure requests</h2>{data.applications.length === 0 && <p className="border rounded-xl bg-card p-5 text-sm">No requests submitted from this account yet. <Link href="/colleges" className="text-primary underline">Find a college</Link> and use Apply Now or Brochure.</p>}{data.applications.map((application: any) => <article key={application.id} className="rounded-xl border bg-card p-5 space-y-2"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{application.targetCollege?.name || "General admissions"}</h3><span className="text-sm font-semibold text-primary">{statuses[application.status] || application.status}</span></div><p className="text-sm text-muted-foreground">{application.ctaType === "DOWNLOAD_BROCHURE" ? "Brochure request" : "Admission enquiry"} · {application.targetCourse || application.targetStream} · {new Date(application.createdAt).toLocaleDateString("en-IN")}</p>{application.targetCollege?.isPublished && <Link className="inline-block text-sm text-primary underline" href={`/college/${application.targetCollege.slug}`}>View college</Link>}</article>)}</section>}
      {tab === "reviews" && <section className="space-y-4"><h2 className="font-bold text-lg">Your college reviews</h2>{data.reviews.length === 0 && <p className="text-sm">You haven’t written a review yet. Open a college’s Reviews tab to share your experience.</p>}{data.reviews.map((review: any) => <article key={review.id} className="border rounded-xl p-5 bg-card space-y-2"><h3 className="font-semibold">{review.title}</h3><p className="text-sm">{review.college.name} · {review.ratingOverall}/5 · {review.moderationStatus === "PENDING" ? "Awaiting moderation" : review.moderationStatus === "APPROVED" ? "Published" : "Not approved"}</p>{review.college.isPublished && <Link className="text-sm text-primary underline" href={`/college/${review.college.slug}/reviews`}>View or edit my review</Link>}</article>)}</section>}
      {tab === "profile" && draft && <form className="border rounded-xl bg-card p-5 space-y-5" onSubmit={async event => { event.preventDefault(); setSaving(true); setError(""); setMessage(""); try { const response = await fetch("/api/v1/student", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: draft.name, phone: draft.phone, targetStream: draft.targetStream, examScores: { entranceExam: draft.entranceExam, rank: draft.rank === "" ? null : Number(draft.rank), category: draft.category, homeState: draft.homeState } }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setData((previous: any) => ({ ...previous, profile: { ...previous.profile, name: draft.name } })); setMessage("Your profile has been saved."); } catch (error) { setError(error instanceof Error ? error.message : "Unable to save profile"); } finally { setSaving(false); } }}>
        <h2 className="font-bold text-lg">Admissions profile</h2><p className="text-sm text-muted-foreground">Account email: {data.profile.email}</p><fieldset disabled={saving} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="text-sm">Full name<input name="studentName" className={control} required minLength={2} maxLength={100} value={draft.name} onChange={event => field("name", event.target.value)} /></label>
          <label className="text-sm">Mobile number<input name="studentPhone" className={control} type="tel" value={draft.phone} onChange={event => field("phone", event.target.value)} /></label>
          <label className="text-sm">Target stream<select name="targetStream" className={control} value={draft.targetStream} onChange={event => field("targetStream", event.target.value)}><option value="">Select stream</option>{["Engineering", "Management", "Medical", "Law", "Design", "Science", "Arts", "Commerce", "Computer Applications"].map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="text-sm">Entrance exam<select name="entranceExam" className={control} value={draft.entranceExam} onChange={event => setDraft({...draft, entranceExam: event.target.value, rank: ""})}>{["jee-main", "neet-ug", "cat"].map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="text-sm">{draft.entranceExam === "cat" ? "Percentile" : "All India rank"}<input name="examRank" className={control} type="number" min={draft.entranceExam === "cat" ? 0 : 1} max={draft.entranceExam === "cat" ? "100" : undefined} step={draft.entranceExam === "cat" ? "0.01" : "1"} value={draft.rank} onChange={event => field("rank", event.target.value)} /></label>
          <label className="text-sm">Category<select name="studentCategory" className={control} value={draft.category} onChange={event => field("category", event.target.value)}>{["GEN", "OBC", "SC", "ST", "EWS"].map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="text-sm sm:col-span-2">Home state / union territory<select name="homeState" className={control} value={draft.homeState} onChange={event => field("homeState", event.target.value)}><option value="">Select state</option>{INDIAN_STATES.map(value => <option key={value}>{value}</option>)}</select></label>
        </fieldset><button disabled={saving} className="rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold">{saving ? "Saving…" : "Save profile"}</button>
      </form>}
    </>}
  </div>;
}
