"use client";

import { useState } from "react";
import { 
  Sparkles, 
  Building2, 
  Radio, 
  HelpCircle, 
  ListOrdered, 
  Save, 
  Send,
  Eye,
  Edit3
} from "lucide-react";
import { SeoGeoChecklist } from "./SeoGeoChecklist";
import { RichBlogRenderer } from "../blog/RichBlogRenderer";
import { RichBlogEditor } from "./RichBlogEditor";
import { BlogCollegeSelector } from "./BlogCollegeSelector";
import { blogCollegeSlugs } from "@/lib/blog-content";

interface BlogMdxEditorProps {
  initialData?: {
    id?: string;
    title: string;
    metaTitle?: string;
    metaDescription?: string;
    featuredImageUrl?: string;
    tldrSummary?: string[];
    contentMdx: string;
    category: string;
    tags?: string[];
    isLiveBlog?: boolean;
    liveUpdatesJson?: { id: string; timestamp: string; headline: string; bodyHtml: string; isPinned: boolean }[];
    relatedCollegeSlug?: string;
  };
  /** When false, the Publish button is hidden (staff without publish permission). */
  canPublish?: boolean;
  onSave: (data: any, isPublish: boolean) => Promise<void>;
}

export function BlogMdxEditor({ initialData, canPublish = true, onSave }: BlogMdxEditorProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [metaTitle, setMetaTitle] = useState(initialData?.metaTitle || "");
  const [metaDescription, setMetaDescription] = useState(initialData?.metaDescription || "");
  const [featuredImageUrl, setFeaturedImageUrl] = useState(initialData?.featuredImageUrl || "");
  const [category, setCategory] = useState(initialData?.category || "CUTOFF_ANALYSIS");
  const [tagsText, setTagsText] = useState((initialData?.tags || []).join(", "));
  const [tldrText, setTldrText] = useState((initialData?.tldrSummary || []).join("\n"));
  const [contentMdx, setContentMdx] = useState(() => {
    const content = initialData?.contentMdx || "";
    const slug = initialData?.relatedCollegeSlug;
    return slug && !blogCollegeSlugs(content).includes(slug) ? `${content}\n\n<EmbeddedCollegeCTA slug="${slug}" />` : content;
  });
  const [mediaBusy, setMediaBusy] = useState(false);
  const [isLiveBlog, setIsLiveBlog] = useState(initialData?.isLiveBlog || false);
  const [liveUpdates, setLiveUpdates] = useState(initialData?.liveUpdatesJson || []);
  const [saveError, setSaveError] = useState("");
  const [activeTab, setActiveTab] = useState<"write" | "source" | "preview">("write");
  const [saving, setSaving] = useState(false);

  const insertShortcode = (shortcode: string) => {
    setContentMdx((prev) => `${prev}\n\n${shortcode}\n\n`);
  };

  const handleFormSubmit = async (publish: boolean) => {
    if (saving || mediaBusy) return;
    setSaving(true);
    setSaveError("");
    try {
      const tldrArray = tldrText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const tagsArray = tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await onSave(
        {
          id: initialData?.id,
          title,
          metaTitle,
          metaDescription,
          featuredImageUrl: featuredImageUrl.trim() || undefined,
          category,
          tags: tagsArray,
          tldrSummary: tldrArray,
          contentMdx,
          relatedCollegeId: null,
          isLiveBlog,
          liveUpdatesJson: liveUpdates,
        },
        publish
      );
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save article.");
    } finally {
      setSaving(false);
    }
  };

  const tldrBullets = tldrText.split("\n").filter(Boolean);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Editor Col */}
      <div className="lg:col-span-2 space-y-5">
        {saveError && <p role="alert" className="p-3 rounded-lg bg-red-50 text-red-700">{saveError}</p>}
        {isLiveBlog && <section className="bg-card border rounded-xl p-5 space-y-4">
          <h2 className="font-bold">Live updates</h2>
          {liveUpdates.map((update, index) => <fieldset key={update.id} className="border rounded-lg p-3 space-y-2">
            <label className="block text-xs">Headline<input aria-label={`Update ${index + 1} headline`} className="block w-full p-2 border rounded" value={update.headline} onChange={event => setLiveUpdates(items => items.map(item => item.id === update.id ? { ...item, headline: event.target.value } : item))} /></label>
            <label className="block text-xs">Date and time<input type="datetime-local" className="block w-full p-2 border rounded" value={new Date(new Date(update.timestamp).getTime() - new Date(update.timestamp).getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={event => { if (event.target.value) setLiveUpdates(items => items.map(item => item.id === update.id ? { ...item, timestamp: new Date(event.target.value).toISOString() } : item)); }} /></label>
            <label className="block text-xs">Update text<textarea className="block w-full p-2 border rounded" value={update.bodyHtml} onChange={event => setLiveUpdates(items => items.map(item => item.id === update.id ? { ...item, bodyHtml: event.target.value } : item))} /></label>
            <label className="text-xs flex gap-2"><input type="checkbox" checked={update.isPinned} onChange={event => setLiveUpdates(items => items.map(item => item.id === update.id ? { ...item, isPinned: event.target.checked } : item))} />Pin this update</label>
            <button type="button" className="text-xs text-red-700 underline" onClick={() => setLiveUpdates(items => items.filter(item => item.id !== update.id))}>Remove update</button>
          </fieldset>)}
          <button type="button" className="border px-3 py-2 rounded text-sm" onClick={() => setLiveUpdates(items => [...items, { id: crypto.randomUUID(), timestamp: new Date().toISOString(), headline: "", bodyHtml: "", isPinned: false }])}>Add live update</button>
        </section>}
        {/* Title Input */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
              Article Editorial Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. JEE Main 2026 Cutoff Analysis: Opening and Closing Ranks for Top NITs"
              className="w-full text-base sm:text-lg font-bold border rounded-lg px-3.5 py-2.5 bg-background outline-hidden focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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

            <div className="flex items-center gap-2 pt-6">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLiveBlog}
                  onChange={(e) => setIsLiveBlog(e.target.checked)}
                  className="rounded text-primary"
                />
                <span className="flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5 text-red-500" />
                  Enable Live Exam Updates Mode
                </span>
              </label>
            </div>
          </div>

          {/* Featured Image URL */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Featured Image URL <span className="font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={featuredImageUrl}
              onChange={(e) => setFeaturedImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full text-xs border rounded-lg px-3 py-2 bg-background outline-hidden focus:border-primary"
            />
            {featuredImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={featuredImageUrl}
                alt="Featured preview"
                className="mt-2 h-24 w-auto rounded-lg object-cover border"
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              />
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Tags <span className="font-normal">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="jee-main, cutoff-2026, nit-rourkela"
              className="w-full text-xs border rounded-lg px-3 py-2 bg-background outline-hidden focus:border-primary"
            />
          </div>
        </div>

        {/* 4-Bullet TLDR Box (AI / GEO Answer Box) */}
        <div className="bg-card border rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>GEO / AEO 4-Bullet Answer Box (1 line per bullet)</span>
            </label>
            <span className="text-[11px] text-muted-foreground">
              {tldrBullets.length} bullet(s)
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Extracted by search engines (Perplexity, Google AI Overviews, ChatGPT) as immediate cited answer.
          </p>
          <textarea
            rows={4}
            value={tldrText}
            onChange={(e) => setTldrText(e.target.value)}
            className="w-full text-xs font-mono border rounded-lg p-3 bg-background outline-hidden focus:border-primary"
          />
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
              <button type="button" disabled={mediaBusy} onClick={() => setActiveTab("source")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${activeTab === "source" ? "bg-background border text-primary" : "text-muted-foreground"}`}>Source</button>
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
                onClick={() => insertShortcode("<BlogTldrBox />")}
                className="px-2 py-1 rounded border bg-background hover:bg-accent text-[11px] font-medium flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-purple-600" />
                <span>+ TL;DR</span>
              </button>
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
          ) : activeTab === "source" ? (
            <textarea
              aria-label="Article source"
              rows={16}
              value={contentMdx}
              onChange={(e) => setContentMdx(e.target.value)}
              placeholder="Write your article content in MDX/Markdown format..."
              className="w-full p-4 text-xs font-mono bg-background outline-hidden resize-y leading-relaxed"
            />
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

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={saving || mediaBusy}
            onClick={() => handleFormSubmit(false)}
            className="px-4 py-2 rounded-lg border bg-background hover:bg-accent text-xs font-bold text-foreground flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save as Draft</span>
          </button>
          {canPublish ? (
            <button
              type="button"
              disabled={saving || mediaBusy}
              onClick={() => handleFormSubmit(true)}
              className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Publish & Index with Vector AI</span>
            </button>
          ) : (
            <span className="text-[11px] text-amber-600 font-semibold px-3 py-2 rounded-lg border bg-amber-50">
              Publishing requires admin approval
            </span>
          )}
        </div>
      </div>

      {/* SEO & GEO Optimization Sidebar */}
      <div className="space-y-5">
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h4 className="font-bold text-sm text-foreground">SEO & Metadata Configuration</h4>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-muted-foreground">SEO Meta Title</span>
              <span className={`text-[11px] font-mono ${metaTitle.length >= 50 && metaTitle.length <= 65 ? "text-emerald-600 font-bold" : "text-amber-600"}`}>
                {metaTitle.length} / 60
              </span>
            </div>
            <input
              type="text"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder="Optimized title tag for SERP (50-60 chars)"
              className="w-full text-xs border rounded-lg px-3 py-2 bg-background outline-hidden focus:border-primary"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-muted-foreground">Meta Description</span>
              <span className={`text-[11px] font-mono ${metaDescription.length >= 140 && metaDescription.length <= 165 ? "text-emerald-600 font-bold" : "text-amber-600"}`}>
                {metaDescription.length} / 160
              </span>
            </div>
            <textarea
              rows={3}
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              placeholder="Compelling SERP snippet summarizing key facts (150-160 chars)"
              className="w-full text-xs border rounded-lg p-2.5 bg-background outline-hidden focus:border-primary"
            />
          </div>
        </div>

        {/* Real-time GEO / SEO Checklist */}
        <SeoGeoChecklist
          metaTitle={metaTitle}
          metaDescription={metaDescription}
          tldrBullets={tldrBullets}
          contentLength={contentMdx.length}
          hasShortcodes={blogCollegeSlugs(contentMdx).length > 0}
        />
      </div>
    </div>
  );
}

