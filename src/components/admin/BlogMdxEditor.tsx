"use client";

import type { BlogDraft } from "@/lib/blog-draft";
import { BlogAutoSuggestions } from "./BlogAutoSuggestions";
import Link from "next/link";
import { RichTextEditor } from "./RichTextEditor";
import { ImageUploadField } from "./ImageUploadField";
import { useEffect, useMemo, useRef, useState } from "react";
import { 
  Building2, 
  Radio, 
  HelpCircle, 
  ListOrdered, 
  Save, 
  Send,
  Eye,
  Edit3,
  CalendarClock,
  CalendarDays
} from "lucide-react";
import { toDateTimeLocalValue } from "@/lib/blog-schedule";
import { SeoGeoChecklist } from "./SeoGeoChecklist";
import { BlogSearchAppearance } from "./BlogSearchAppearance";
import { analyzeBlogContent } from "@/lib/blog-readability";
import { RichBlogRenderer } from "../blog/RichBlogRenderer";
import { RichBlogEditor } from "./RichBlogEditor";
import { BlogCollegeSelector } from "./BlogCollegeSelector";
import { blogCollegeSlugs } from "@/lib/blog-content";

interface BlogMdxEditorProps {
  initialDestination?: "website" | "college";
  initialCollegeSlug?: string;
  initialData?: {
    likesEnabled?: boolean;
    commentsEnabled?: boolean;
    status?: string;
    publishedAt?: string | Date | null;
    faqsJson?: { question: string; answer: string }[];
    id?: string;
    slug?: string;
    publicPath?: string;
    title: string;
    metaTitle?: string;
    metaDescription?: string;
    featuredImageUrl?: string;
    tldrSummary?: string[];
    contentMdx: string;
    category: string;
    tags?: string[];
    showOnWebsiteBlog?: boolean;
    isLiveBlog?: boolean;
    liveUpdatesJson?: { id: string; timestamp: string; headline: string; bodyHtml: string; isPinned: boolean }[];
    relatedCollegeSlug?: string;
  };
  /** When false, the Publish button is hidden (staff without publish permission). */
  canPublish?: boolean;
  onSave: (data: any, isPublish: boolean) => Promise<void>;
}

export function BlogMdxEditor({ initialDestination, initialCollegeSlug, initialData, canPublish = true, onSave }: BlogMdxEditorProps) {
  const showOnWebsiteBlog = initialData?.showOnWebsiteBlog ?? (initialDestination ? initialDestination === "website" : !initialCollegeSlug);
  const [likesEnabled, setLikesEnabled] = useState(initialData?.likesEnabled ?? true);
  const [commentsEnabled, setCommentsEnabled] = useState(initialData?.commentsEnabled ?? true);
  const [title, setTitle] = useState(initialData?.title || "");
  const [metaTitle, setMetaTitle] = useState(initialData?.metaTitle || "");
  const [metaDescription, setMetaDescription] = useState(initialData?.metaDescription || "");
  const [featuredImageUrl, setFeaturedImageUrl] = useState(initialData?.featuredImageUrl || "");
  const [category, setCategory] = useState(initialData?.category || "CUTOFF_ANALYSIS");
  const [tagsText, setTagsText] = useState((initialData?.tags || []).join(", "));
  const tldrBullets = initialData?.tldrSummary || [];
  const [contentMdx, setContentMdx] = useState(() => {
    const content = initialData?.contentMdx || "";
    const slug = initialData?.relatedCollegeSlug || initialCollegeSlug;
    return slug && !blogCollegeSlugs(content).includes(slug) ? `${content}\n\n<EmbeddedCollegeCTA slug="${slug}" />` : content;
  });
  const [featuredBusy, setFeaturedBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [isLiveBlog, setIsLiveBlog] = useState(initialData?.isLiveBlog || false);
  const [liveUpdates, setLiveUpdates] = useState(initialData?.liveUpdatesJson || []);
  const [faqs, setFaqs] = useState(initialData?.faqsJson || []);
  const [saveError, setSaveError] = useState("");
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"now" | "schedule">(
    initialData?.status === "SCHEDULED" && initialData?.publishedAt ? "schedule" : "now"
  );
  const [scheduledAt, setScheduledAt] = useState<string>(() =>
    initialData?.status === "SCHEDULED" && initialData?.publishedAt
      ? toDateTimeLocalValue(initialData.publishedAt)
      : ""
  );

  const setPresetSchedule = (daysAhead: number, hour: number, minute = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    d.setHours(hour, minute, 0, 0);
    setScheduleMode("schedule");
    setScheduledAt(toDateTimeLocalValue(d));
  };

  const snapshot = JSON.stringify({ likesEnabled, commentsEnabled, title, metaTitle, metaDescription, featuredImageUrl, category, tagsText, contentMdx, showOnWebsiteBlog, isLiveBlog, liveUpdates, faqs, scheduleMode, scheduledAt });
  const initialSnapshot = useRef(snapshot);
  const dirty = initialSnapshot.current !== snapshot;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const reading = useMemo(() => analyzeBlogContent(contentMdx), [contentMdx]);
  const wordCount = reading.wordCount;
  const tags = tagsText.split(",").map(tag => tag.trim()).filter(Boolean);
  const previewSlug = initialData?.slug || title.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 80).replace(/^-+|-+$/g, "") || "article";
  const previewCollege = initialData?.relatedCollegeSlug || blogCollegeSlugs(contentMdx).sort()[0] || "college";
  const previewPath = initialData?.publicPath || (showOnWebsiteBlog ? `/blog/${previewSlug}` : `/college/${previewCollege}/blogs/${previewSlug}`);

  const insertShortcode = (shortcode: string) => {
    setContentMdx((prev) => `${prev}\n\n${shortcode}\n\n`);
  };

  const handleFormSubmit = async (publish: boolean, useSchedule = false) => {
    if (saving || mediaBusy || featuredBusy || generating) return;
    setSaving(true);
    setSaveError("");
    try {
      if (title.trim().length < 3) throw new Error("Enter an article title with at least 3 characters.");
      if (contentMdx.replace(/<[^>]*>/g, " ").trim().length < 10) throw new Error("Write at least 10 characters of article content.");
      if (faqs.some(faq => !faq.question.trim() || !faq.answer.trim())) throw new Error("Complete both the question and answer for each FAQ, or remove the empty FAQ.");
      const tagsArray = tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      let scheduledIso: string | null = null;
      if (useSchedule) {
        if (!scheduledAt) throw new Error("Select a schedule date and time before scheduling.");
        const parsed = new Date(scheduledAt);
        if (Number.isNaN(parsed.getTime())) throw new Error("Enter a valid schedule date and time.");
        if (parsed.getTime() <= Date.now()) throw new Error("Schedule date and time must be in the future, or switch to Publish immediately.");
        scheduledIso = parsed.toISOString();
      }

      if (!showOnWebsiteBlog && (publish || useSchedule) && blogCollegeSlugs(contentMdx).length === 0) throw new Error("Select at least one college in Colleges linked to this article before publishing or scheduling.");

      await onSave(
        {
          id: initialData?.id,
          title: title.trim(),
          metaTitle,
          metaDescription,
          featuredImageUrl: featuredImageUrl.trim(),
          faqsJson: faqs.map(faq => ({ question: faq.question.trim(), answer: faq.answer.trim() })),
          category,
          tags: tagsArray,
          tldrSummary: tldrBullets,
          contentMdx,
          relatedCollegeId: null,
          showOnWebsiteBlog,
          likesEnabled,
          commentsEnabled,
          isLiveBlog,
          liveUpdatesJson: liveUpdates,
          scheduledAt: scheduledIso,
        },
        publish && !useSchedule
      );
      initialSnapshot.current = snapshot;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save article.");
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="grid min-w-0 grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
      {/* Main Editor Col */}
      <div className="min-w-0 xl:col-span-2 space-y-5">
        {saveError && <p role="alert" className="p-3 rounded-lg bg-red-50 text-red-700">{saveError}</p>}
        {isLiveBlog && <section className="bg-card border rounded-xl p-5 space-y-4">
          <h2 className="font-bold">Live updates</h2>
          {liveUpdates.map((update, index) => <fieldset key={update.id} className="border rounded-lg p-3 space-y-2">
            <label className="block text-xs">Headline<input aria-label={`Update ${index + 1} headline`} className="block w-full p-2 border rounded" value={update.headline} onChange={event => setLiveUpdates(items => items.map(item => item.id === update.id ? { ...item, headline: event.target.value } : item))} /></label>
            <label className="block text-xs">Date and time<input type="datetime-local" className="block w-full p-2 border rounded" value={new Date(new Date(update.timestamp).getTime() - new Date(update.timestamp).getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={event => { if (event.target.value) setLiveUpdates(items => items.map(item => item.id === update.id ? { ...item, timestamp: new Date(event.target.value).toISOString() } : item)); }} /></label>
            <RichTextEditor label="Live update text" value={update.bodyHtml} onChange={value => setLiveUpdates(items => items.map(item => item.id === update.id ? { ...item, bodyHtml: value } : item))} disabled={saving} />
            <label className="text-xs flex gap-2"><input type="checkbox" checked={update.isPinned} onChange={event => setLiveUpdates(items => items.map(item => item.id === update.id ? { ...item, isPinned: event.target.checked } : item))} />Pin this update</label>
            <button type="button" className="text-xs text-red-700 underline" onClick={() => setLiveUpdates(items => items.filter(item => item.id !== update.id))}>Remove update</button>
          </fieldset>)}
          <button type="button" className="border px-3 py-2 rounded text-sm" onClick={() => setLiveUpdates(items => [...items, { id: crypto.randomUUID(), timestamp: new Date().toISOString(), headline: "", bodyHtml: "", isPinned: false }])}>Add live update</button>
        </section>}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 text-xs text-muted-foreground"><span>{initialData?.status || "New article"} · {dirty ? "Unsaved changes" : "No unsaved changes"}</span><span>{wordCount} words · {Math.max(1, Math.ceil(wordCount / 200))} min read</span></div>
        {/* Title Input */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
              Article title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. JEE Main 2027 Cutoff Analysis: Opening and Closing Ranks for Top NITs"
              className="w-full text-base sm:text-lg font-bold border rounded-lg px-3.5 py-2.5 bg-background outline-hidden focus:border-primary"
            />
          </div>

        <BlogAutoSuggestions title={title} collegeSlugs={blogCollegeSlugs(contentMdx)} disabled={saving || mediaBusy || featuredBusy} hasContent={contentMdx.replace(/<EmbeddedCollegeCTA[^>]*\/>/g, "").replace(/<[^>]*>/g, "").trim().length > 0} onBusyChange={setGenerating} onApply={(draft: BlogDraft) => {
          const collegeBlocks = blogCollegeSlugs(contentMdx).map(slug => `<EmbeddedCollegeCTA slug="${slug}" />`).join("\n\n");
          setContentMdx(`${draft.contentHtml}${collegeBlocks ? `\n\n${collegeBlocks}` : ""}`);
          setMetaTitle(draft.metaTitle); setMetaDescription(draft.metaDescription);
          setTagsText(draft.tags.join(", ")); setCategory(draft.category); setFaqs(draft.faqs); setActiveTab("write");
        }} />

          <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs border rounded-lg px-3 py-2 bg-background"
              >
                <option value="EXAM_NEWS">Exam News & Live Updates</option>
                <option value="ADMISSION_ALERT">Admission Alert</option>
                <option value="CUTOFF_ANALYSIS">Cutoff Analysis</option>
                <option value="COLLEGE_ROUNDUP">College Roundup</option>
                <option value="CAREER_GUIDE">Career Guide</option>
                <option value="SCHOLARSHIP">Scholarships</option>
              </select>
            </div>

            <div className="flex items-center gap-2 sm:pt-6">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLiveBlog}
                  onChange={(e) => setIsLiveBlog(e.target.checked)}
                  className="rounded text-primary"
                />
                <span className="flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5 text-red-500" />
                  Enable live updates
                </span>
              </label>
            </div>
          </div>

          <ImageUploadField label="Featured image (optional)" purpose="blogs" values={featuredImageUrl ? [featuredImageUrl] : []} onChange={values => setFeaturedImageUrl(values[0] || "")} disabled={saving} onBusyChange={setFeaturedBusy} />

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Tags <span className="font-normal">(first tag = main topic)</span>
            </label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="jee-main, cutoff-2027, nit-rourkela"
              className="w-full text-xs border rounded-lg px-3 py-2 bg-background outline-hidden focus:border-primary"
            />
          </div>
        </div>

        <BlogCollegeSelector content={contentMdx} onChange={setContentMdx} />

        {/* MDX & Shortcode Toolbar */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="p-3 border-b bg-muted/30 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={mediaBusy}
                onClick={() => setActiveTab("write")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  activeTab === "write" ? "bg-background border shadow-2xs text-primary" : "text-muted-foreground"
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Visual editor</span>
              </button>
              <button
                type="button"
                disabled={mediaBusy}
                onClick={() => setActiveTab("preview")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  activeTab === "preview" ? "bg-background border shadow-2xs text-primary" : "text-muted-foreground"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Live Preview</span>
              </button>
            </div>

            {/* Shortcode Inserters */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground text-[11px] mr-1 hidden sm:inline">Insert Block:</span>
              <button
                type="button"
                onClick={() => insertShortcode("<LiveBlogTicker />")}
                className="px-2 py-1 rounded border bg-background hover:bg-accent text-[11px] font-medium flex items-center gap-1 cursor-pointer"
              >
                <Radio className="w-3 h-3 text-red-600" />
                <span>+ Live Feed</span>
              </button>
            </div>
          </div>

          {activeTab === "write" ? (
            <RichBlogEditor value={contentMdx} onChange={setContentMdx} onBusyChange={setMediaBusy} />
          ) : (
            <div className="p-6 bg-background max-h-[500px] overflow-y-auto">
              <RichBlogRenderer
                content={contentMdx}
                tldrSummary={tldrBullets}
                isLiveBlog={isLiveBlog}
                liveUpdates={liveUpdates}
                blogId={initialData?.id || "preview-id"}
              />
            </div>
          )}
        </div>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Frequently asked questions</h2><button type="button" disabled={saving} className="rounded-lg border px-3 py-2 text-xs font-semibold" onClick={() => setFaqs(items => [...items, { question: "", answer: "" }])}>Add question</button></div>
          <p className="text-xs text-muted-foreground">Optional questions and answers appear below the article.</p>
          {faqs.map((faq, index) => <fieldset key={index} className="space-y-2 rounded-lg border p-3"><legend className="px-1 text-xs">Question {index + 1}</legend><label className="block text-xs">Question<input value={faq.question} disabled={saving} onChange={event => setFaqs(items => items.map((item, i) => i === index ? { ...item, question: event.target.value } : item))} className="mt-1 w-full rounded border bg-background p-2 text-sm" /></label><label className="block text-xs">Answer<textarea value={faq.answer} disabled={saving} onChange={event => setFaqs(items => items.map((item, i) => i === index ? { ...item, answer: event.target.value } : item))} rows={3} className="mt-1 w-full rounded border bg-background p-2 text-sm" /></label><button type="button" disabled={saving} onClick={() => setFaqs(items => items.filter((_, i) => i !== index))} className="text-xs text-red-600 underline">Remove question</button></fieldset>)}
        </section>
        {/* Action Buttons */}
        <div className="admin-form-actions admin-sticky-actions sticky bottom-0 z-20 flex flex-wrap items-center justify-end gap-3 rounded-xl border bg-card p-4 shadow-lg">
          <button
            type="button"
            disabled={saving || mediaBusy || featuredBusy || generating}
            onClick={() => { if (initialData?.status !== "PUBLISHED" || window.confirm("Move this article to drafts? It will no longer be publicly visible.")) void handleFormSubmit(false); }}
            className="px-4 py-2 rounded-lg border bg-background hover:bg-accent text-xs font-bold text-foreground flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Saving…" : initialData?.status === "PUBLISHED" ? "Move to draft" : "Save draft"}</span>
          </button>
          {canPublish ? (
            scheduleMode === "schedule" ? (
              <button
                type="button"
                disabled={saving || mediaBusy || featuredBusy || generating}
                onClick={() => handleFormSubmit(false, true)}
                className="px-5 py-2 rounded-lg bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-purple-800 transition-colors shadow-xs cursor-pointer"
              >
                <CalendarClock className="w-3.5 h-3.5" />
                <span>{saving ? "Scheduling…" : initialData?.status === "SCHEDULED" ? "Update schedule" : "Schedule article"}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={saving || mediaBusy || featuredBusy || generating}
                onClick={() => handleFormSubmit(true, false)}
                className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{saving ? "Saving…" : initialData?.status === "PUBLISHED" ? "Update published article" : "Publish article"}</span>
              </button>
            )
          ) : (
            <span className="text-[11px] text-amber-600 font-semibold px-3 py-2 rounded-lg border bg-amber-50">
              Publishing requires admin approval
            </span>
          )}
        </div>
      </div>

      {/* SEO & GEO Optimization Sidebar */}
      <div className="min-w-0 space-y-5">

        {canPublish && (
          <section className="space-y-3 rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold text-sm flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4 text-purple-700" />
                <span>Publish schedule</span>
              </h2>
              <Link
                href="/admin/blogs/calendar"
                className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Full calendar
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setScheduleMode("now")}
                className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                  scheduleMode === "now"
                    ? "border-primary bg-primary/10 text-primary"
                    : "bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                Publish now
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setScheduleMode("schedule");
                  if (!scheduledAt) setPresetSchedule(1, 9, 0);
                }}
                className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                  scheduleMode === "schedule"
                    ? "border-purple-600 bg-purple-50 text-purple-800"
                    : "bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                Schedule later
              </button>
            </div>

            {scheduleMode === "schedule" && (
              <div className="space-y-2.5 pt-1">
                <label className="block text-xs font-semibold text-muted-foreground">
                  Date &amp; time to auto-publish
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    min={toDateTimeLocalValue(new Date())}
                    disabled={saving}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="mt-1 block w-full rounded-lg border bg-background px-3 py-2 text-xs font-medium text-foreground"
                  />
                </label>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setPresetSchedule(1, 9, 0)}
                    className="rounded-md border bg-muted/40 px-2 py-1 text-[11px] font-medium hover:bg-accent cursor-pointer"
                  >
                    Tomorrow 9 AM
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setPresetSchedule(2, 10, 0)}
                    className="rounded-md border bg-muted/40 px-2 py-1 text-[11px] font-medium hover:bg-accent cursor-pointer"
                  >
                    +2 Days 10 AM
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setPresetSchedule(7, 9, 0)}
                    className="rounded-md border bg-muted/40 px-2 py-1 text-[11px] font-medium hover:bg-accent cursor-pointer"
                  >
                    Next Week
                  </button>
                </div>

                {scheduledAt && !Number.isNaN(new Date(scheduledAt).getTime()) && (
                  <p className="rounded-lg bg-purple-50 border border-purple-200 px-3 py-2 text-[11px] text-purple-900">
                    Will go live automatically on{" "}
                    <strong>
                      {new Date(scheduledAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </strong>
                    .
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="font-bold text-sm">Likes &amp; comments</h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={likesEnabled} disabled={saving} onChange={event => setLikesEnabled(event.target.checked)} />Allow readers to like this article</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={commentsEnabled} disabled={saving} onChange={event => setCommentsEnabled(event.target.checked)} />Allow reader comments</label>
          <p className="text-xs text-muted-foreground">Comments appear immediately. You can hide or delete them from comment management. Save the article to apply these settings.</p>
          {initialData?.id ? <Link href={`/admin/blogs/${initialData.id}/engagement`} className="inline-block rounded-lg border px-3 py-2 text-sm font-semibold text-primary">Manage likes &amp; comments</Link> : <p className="text-xs text-muted-foreground">Save this article first to open comment moderation.</p>}
        </section>
        <BlogSearchAppearance
          title={title} metaTitle={metaTitle} metaDescription={metaDescription}
          content={contentMdx} featuredImageUrl={featuredImageUrl} previewPath={previewPath}
          onTitleChange={setMetaTitle} onDescriptionChange={setMetaDescription} disabled={saving || generating}
        />

        {/* Real-time GEO / SEO Checklist */}
        <SeoGeoChecklist
          title={title} metaTitle={metaTitle} metaDescription={metaDescription}
          content={contentMdx} featuredImageUrl={featuredImageUrl} tags={tags}
          hasShortcodes={blogCollegeSlugs(contentMdx).length > 0}
          faqCount={faqs.filter(faq => faq.question.trim() && faq.answer.trim()).length}
        />
      </div>
    </div>
  );
}

