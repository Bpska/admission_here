"use client";

import { InitialCollegeBlogEditor, emptyCollegeBlog } from "@/components/admin/InitialCollegeBlogEditor";
import { CollegeOnboardingSections, emptyOnboardingDraft, serializeOnboarding } from "@/components/admin/CollegeOnboardingSections";
import { CollegeSectionNavigation } from "@/components/admin/CollegeSectionNavigation";
import { CollegeQuestionsEditor, type CollegeQuestion } from "@/components/admin/CollegeQuestionsEditor";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { ImageUploadField } from "@/components/admin/ImageUploadField";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Save, ArrowLeft, MapPin, Globe, Phone, Mail, Home, GraduationCap, ImageIcon } from "lucide-react";
import Link from "next/link";
import { defaultNavbarFilter } from "@/lib/navbar-filters";
import { CollegeNavbarFields } from "@/components/admin/CollegeNavbarFields";
import { slugifyCollegeName } from "@/lib/college-slug";

export function NewCollegeClient({ requiresApproval }: { requiresApproval: boolean }) {
  const router = useRouter();

  const [initialBlog, setInitialBlog] = useState(emptyCollegeBlog);
  const [onboarding, setOnboarding] = useState(emptyOnboardingDraft);
  const [questions, setQuestions] = useState<CollegeQuestion[]>([]);
  const [affiliatedTo, setAffiliatedTo] = useState("");
  const [approvedBy, setApprovedBy] = useState("");

  // Basic Information
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [uploads, setUploads] = useState(0);
  const onUploadBusy = (busy: boolean) => setUploads(count => count + (busy ? 1 : -1));
  const [logoUrl, setLogoUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [brochurePdfUrl, setBrochurePdfUrl] = useState("");
  const [ownershipType, setOwnershipType] = useState("PUBLIC_GOVERNMENT");
  const [estYear, setEstYear] = useState("");
  const [naacGrade, setNaacGrade] = useState("");
  const [campusAreaAcres, setCampusAreaAcres] = useState("");

  // Location & Contact
  const [city, setCity] = useState("");
  const [state, setState] = useState("Odisha");
  const [pincode, setPincode] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // Descriptions & Details
  const [overviewHtml, setOverviewHtml] = useState(
    ""
  );
  const [admissionHtml, setAdmissionHtml] = useState("");
  const [hostelInfo, setHostelInfo] = useState("");
  const [scholarshipInfo, setScholarshipInfo] = useState("");
  const [facilitiesText, setFacilitiesText] = useState(
    ""
  );
  const [galleryText, setGalleryText] = useState("");

  // SEO & Status
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [showInNavbar, setShowInNavbar] = useState(false);
  const [navbarCategory, setNavbarCategory] = useState("");
  const [navbarSection, setNavbarSection] = useState("featured");
  const [navbarFilter, setNavbarFilter] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugEdited) setSlug(slugifyCollegeName(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploads > 0) return;
    if (loading) return;
    setLoading(true);
    setError(null);

    const facilitiesArray = facilitiesText
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    const galleryArray = galleryText
      .split("\n")
      .map((g) => g.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/v1/cms/colleges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initialBlog: initialBlog.enabled ? { title: initialBlog.title, contentMdx: initialBlog.contentMdx, category: initialBlog.category, showOnWebsiteBlog: initialBlog.showOnWebsiteBlog, featuredImageUrl: initialBlog.featuredImageUrl || null, metaDescription: initialBlog.metaDescription, publish: initialBlog.publish } : undefined,
          onboardingData: serializeOnboarding(onboarding),
          faqsJson: questions,
          affiliatedTo: affiliatedTo.trim() || null,
          approvedBy: approvedBy.split(",").map(item => item.trim()).filter(Boolean),
          name: name.trim(),
          shortName: shortName.trim() || null,
          slug: slug.trim().toLowerCase(),
          logoUrl: logoUrl.trim() || null,
          coverImageUrl: coverImageUrl.trim() || null,
          brochurePdfUrl: brochurePdfUrl.trim() || null,
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim() || null,
          fullAddress: fullAddress.trim() || null,
          websiteUrl: websiteUrl.trim() || null,
          contactPhone: contactPhone.trim() || null,
          contactEmail: contactEmail.trim() || null,
          estYear: estYear ? parseInt(estYear, 10) : null,
          ownershipType,
          naacGrade: naacGrade.trim() || null,
          campusAreaAcres: campusAreaAcres ? parseFloat(campusAreaAcres) : null,
          overviewHtml,
          admissionHtml: admissionHtml.trim() || null,
          hostelInfo: hostelInfo.trim() || null,
          scholarshipInfo: scholarshipInfo.trim() || null,
          facilitiesJson: facilitiesArray,
          galleryUrls: galleryArray,
          metaTitle: metaTitle.trim() || null,
          metaDescription: metaDescription.trim() || null,
          isPublished,
          showInNavbar,
          navbarCategory: navbarCategory || null,
          navbarSection,
          navbarFilter: navbarFilter || null,
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        router.push(json.pendingApproval
          ? `/admin/colleges?submitted=${encodeURIComponent(json.requestId)}`
          : `/admin/colleges/${json.college.id}/edit`);
        router.refresh();
      } else {
        setError(json.error || "Failed to create college profile");
      }
    } catch {
      setError("Network error while creating college profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/colleges"
          className="p-2 rounded-lg border hover:bg-accent text-muted-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">
            {requiresApproval ? "Submit New College for Approval" : "Onboard New Institutional Profile"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {requiresApproval
              ? "Your submission goes to the administrator for review. The college becomes public only after approval."
              : "Enter verified details for college indexing, schema generation, and SEO directory discovery."}
          </p>
        </div>
      </div>

      <CollegeSectionNavigation />

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl">
            {error}
          </div>
        )}

        {/* BASIC INFORMATION */}
        <div id="college-overview" className="scroll-mt-6 bg-card border rounded-2xl p-6 sm:p-7 space-y-4 shadow-xs">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider text-muted-foreground border-b pb-2 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-primary" />
            <span>1. Basic Profile</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold text-foreground mb-1">
                Full Official Institution Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. National Institute of Technology Rourkela"
                className="w-full border rounded-lg px-3 py-2 bg-background outline-hidden focus:border-primary font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground mb-1">
                Short Name / Acronym
              </label>
              <input
                type="text"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="e.g. NIT Rourkela"
                className="w-full border rounded-lg px-3 py-2 bg-background outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground mb-1">
                Canonical URL Slug *
              </label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => { setSlugEdited(true); setSlug(e.target.value); }}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                minLength={2}
                maxLength={80}
                title="Use lowercase words separated by hyphens, such as nit-rourkela. Enter the website in Website URL."
                placeholder="e.g. nit-rourkela"
                className="w-full font-mono border rounded-lg px-3 py-2 bg-background outline-hidden focus:border-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">Profile address: /college/{slug || "college-name"}. Enter the external website in Website URL.</p>
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground mb-1">
                Ownership Type
              </label>
              <select
                value={ownershipType}
                onChange={(e) => setOwnershipType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 bg-background"
              >
                <option value="PUBLIC_GOVERNMENT">Public / Government</option>
                <option value="PRIVATE">Private</option>
                <option value="AIDED">Government Aided</option>
                <option value="DEEMED">Deemed to be University</option>
                <option value="AUTONOMOUS">Autonomous</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground mb-1">
                Establishment Year
              </label>
              <input
                type="number"
                value={estYear}
                onChange={(e) => setEstYear(e.target.value)}
                placeholder="e.g. 1961"
                className="w-full border rounded-lg px-3 py-2 bg-background outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground mb-1">
                NAAC Accreditation
              </label>
              <select
                value={naacGrade}
                onChange={(e) => setNaacGrade(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 bg-background"
              >
                <option value="">Not specified</option>
                <option value="A++">A++</option>
                <option value="A+">A+</option>
                <option value="A">A</option>
                <option value="B++">B++</option>
                <option value="B">B</option>
                <option value="Not Accredited">Not Accredited</option>
              </select>
            </div>

            <label className="block space-y-1"><span className="font-semibold text-muted-foreground">Affiliated university / board</span><input value={affiliatedTo} onChange={event => setAffiliatedTo(event.target.value)} className="w-full rounded-lg border bg-background p-2" /></label>
            <label className="block space-y-1"><span className="font-semibold text-muted-foreground">Approvals (comma separated)</span><input value={approvedBy} onChange={event => setApprovedBy(event.target.value)} placeholder="AICTE, UGC" className="w-full rounded-lg border bg-background p-2" /></label>
            <div>
              <label className="block font-semibold text-muted-foreground mb-1">
                Campus Size (in Acres)
              </label>
              <input
                type="number"
                step="0.1"
                value={campusAreaAcres}
                onChange={(e) => setCampusAreaAcres(e.target.value)}
                placeholder="e.g. 647"
                className="w-full border rounded-lg px-3 py-2 bg-background outline-hidden focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* MEDIA & IMAGES */}
        <div className="bg-card border rounded-2xl p-6 sm:p-7 space-y-4 shadow-xs">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider text-muted-foreground border-b pb-2 flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-purple-600" />
            <span>2. Media Assets (Logo, Cover Banner &amp; Gallery)</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <ImageUploadField label="College logo" values={logoUrl ? [logoUrl] : []} onChange={values => setLogoUrl(values[0] || "")} disabled={loading || uploads > 0} onBusyChange={onUploadBusy} />

            <ImageUploadField label="Campus cover photo" values={coverImageUrl ? [coverImageUrl] : []} onChange={values => setCoverImageUrl(values[0] || "")} disabled={loading || uploads > 0} onBusyChange={onUploadBusy} />

            <div id="college-gallery" className="sm:col-span-2 scroll-mt-6">
              <ImageUploadField label="Campus gallery photos" multiple values={galleryText.split("\n").filter(Boolean)} onChange={values => setGalleryText(values.join("\n"))} disabled={loading || uploads > 0} onBusyChange={onUploadBusy} />
            </div>
          </div>
        </div>

        {/* LOCATION & CONTACT */}
        <div className="bg-card border rounded-2xl p-6 sm:p-7 space-y-4 shadow-xs">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider text-muted-foreground border-b pb-2 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span>3. Location &amp; Contact</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-foreground mb-1">City *</label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Rourkela"
                className="w-full border rounded-lg px-3 py-2 bg-background outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block font-bold text-foreground mb-1">State *</label>
              <input
                type="text"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Odisha"
                className="w-full border rounded-lg px-3 py-2 bg-background outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground mb-1">Pincode</label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="e.g. 769008"
                className="w-full border rounded-lg px-3 py-2 bg-background outline-hidden focus:border-primary"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block font-semibold text-muted-foreground mb-1">Full Campus Address</label>
              <input
                type="text"
                value={fullAddress}
                onChange={(e) => setFullAddress(e.target.value)}
                placeholder="e.g. Sector 1, Rourkela, Sundargarh, Odisha, India"
                className="w-full border rounded-lg px-3 py-2 bg-background outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground mb-1">Official Website</label>
              <input
                type="text"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://www.nitrkl.ac.in"
                className="w-full border rounded-lg px-3 py-2 bg-background outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground mb-1">Admissions Phone</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+91 661 2462020"
                className="w-full border rounded-lg px-3 py-2 bg-background outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground mb-1">Admissions Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="admissions@nitrkl.ac.in"
                className="w-full border rounded-lg px-3 py-2 bg-background outline-hidden focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* OVERVIEW & DESCRIPTIONS */}
        <div className="bg-card border rounded-2xl p-6 sm:p-7 space-y-4 shadow-xs">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider text-muted-foreground border-b pb-2 flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-emerald-600" />
            <span>4. Overview, Hostel &amp; Facilities</span>
          </h2>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-foreground mb-1">
                Overview &amp; History
              </label>
              <RichTextEditor label="Institutional overview" value={overviewHtml} onChange={setOverviewHtml} disabled={loading} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-muted-foreground mb-1">
                  Hostel &amp; Mess Information
                </label>
                <RichTextEditor label="Hostel and mess information" value={hostelInfo} onChange={setHostelInfo} disabled={loading} />
              </div>

              <div>
                <label className="block font-semibold text-muted-foreground mb-1">
                  Scholarships &amp; Concessions
                </label>
                <RichTextEditor label="Scholarships and concessions" value={scholarshipInfo} onChange={setScholarshipInfo} disabled={loading} />
              </div>
            </div>
          </div>
        </div>

        <section id="college-admission" className="scroll-mt-6 space-y-4 rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-bold">Admission</h2>
          <div className="space-y-1 text-xs font-semibold"><p>Admission procedure, eligibility and important dates</p><RichTextEditor label="Admission procedure and eligibility" value={admissionHtml} onChange={setAdmissionHtml} disabled={loading} /></div>
          <label className="block space-y-1 text-xs font-semibold"><span>Official brochure PDF URL</span><input type="url" value={brochurePdfUrl} onChange={event => setBrochurePdfUrl(event.target.value)} className="w-full rounded-lg border bg-background p-2 text-sm" /></label>
        </section>
        <section className="space-y-4 rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-bold">Facilities</h2>
          <label className="block space-y-1 text-xs font-semibold"><span>Facilities (one per line)</span><textarea rows={5} value={facilitiesText} onChange={event => setFacilitiesText(event.target.value)} className="w-full rounded-lg border bg-background p-3 text-sm" /></label>
        </section>
        <CollegeOnboardingSections value={onboarding} onChange={setOnboarding} disabled={loading} onBusyChange={onUploadBusy} />
        <section id="college-reviews" className="scroll-mt-6 space-y-2 rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-bold">Reviews</h2>
          <p className="text-sm text-muted-foreground">Once the college is created, students can submit reviews. Review and approve their submissions from this college’s editor or the review moderation queue.</p>
        </section>
        <InitialCollegeBlogEditor value={initialBlog} onChange={setInitialBlog} disabled={loading || uploads > 0} onBusyChange={onUploadBusy} requiresApproval={requiresApproval} />
        <CollegeQuestionsEditor value={questions} onChange={setQuestions} disabled={loading} />
        <section className="space-y-4 rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-bold">SEO & publication</h2>
          <label className="block space-y-1 text-xs font-semibold"><span>SEO title</span><input value={metaTitle} onChange={event => setMetaTitle(event.target.value)} className="w-full rounded-lg border bg-background p-2 text-sm" /></label>
          <label className="block space-y-1 text-xs font-semibold"><span>SEO description</span><textarea rows={3} value={metaDescription} onChange={event => setMetaDescription(event.target.value)} className="w-full rounded-lg border bg-background p-2 text-sm" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isPublished} onChange={event => setIsPublished(event.target.checked)} />Publish college after saving{requiresApproval ? " and administrator approval" : ""}</label>
        </section>

        <CollegeNavbarFields enabled={showInNavbar} category={navbarCategory} section={navbarSection} filter={navbarFilter} onFilterChange={setNavbarFilter} onSectionChange={setNavbarSection} onEnabledChange={setShowInNavbar} onCategoryChange={setNavbarCategory} />

        {/* SUBMIT BUTTONS */}
        <div className="admin-form-actions flex flex-wrap justify-end gap-3 pt-3 border-t">
          <Link
            href="/admin/colleges"
            className="px-4 py-2.5 rounded-xl border text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || uploads > 0}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-2 hover:opacity-95 active:scale-98 transition-all cursor-pointer"
            style={{ background: "#1a3068" }}
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{requiresApproval ? "Submitting for Approval..." : "Onboarding College..."}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{requiresApproval ? "Submit for Admin Approval" : "Create Institutional Profile"}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
