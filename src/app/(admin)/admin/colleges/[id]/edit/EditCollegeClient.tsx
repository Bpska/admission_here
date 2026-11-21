"use client";

import { CollegeBlogsSection } from "@/components/admin/CollegeBlogsSection";
import { AdminDataEditor } from "@/components/admin/AdminDataEditor";
import { CollegeSectionNavigation } from "@/components/admin/CollegeSectionNavigation";
import { CollegeQuestionsEditor } from "@/components/admin/CollegeQuestionsEditor";
import { CollegeReviewSection } from "@/components/admin/CollegeReviewSection";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { ImageUploadField } from "@/components/admin/ImageUploadField";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { defaultNavbarFilter } from "@/lib/navbar-filters";
import { CollegeNavbarFields } from "@/components/admin/CollegeNavbarFields";
import { 
  Building2, 
  Save, 
  ArrowLeft, 
  Eye, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Home, 
  GraduationCap, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Image as ImageIcon,
  Check,
  Plus,
  Trash2
} from "lucide-react";

interface EditCollegeClientProps {
  approvalRequest?: { id: string; updatedAt: string };
  college: {
    id: string;
    name: string;
    shortName?: string | null;
    affiliatedTo?: string | null;
    approvedBy?: string[];
    slug: string;
    logoUrl?: string | null;
    coverImageUrl?: string | null;
    brochurePdfUrl?: string | null;
    city: string;
    state: string;
    pincode?: string | null;
    fullAddress?: string | null;
    websiteUrl?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    estYear?: number | null;
    ownershipType: string;
    nirfRank?: number | null;
    naacGrade?: string | null;
    campusAreaAcres?: number | null;
    overviewHtml: string;
    admissionHtml?: string | null;
    scholarshipInfo?: string | null;
    hostelInfo?: string | null;
    facilitiesJson?: any;
    galleryUrls: string[];
    faqsJson?: any;
    qnaJson?: any;
    metaTitle?: string | null;
    metaDescription?: string | null;
    isPublished: boolean;
    showInNavbar?: boolean;
    navbarCategory?: string | null;
    navbarSection?: string;
    navbarFilter?: string | null;
    courses: any[];
    onboardingData?: { offerings: any[]; cutoffs: any[]; placements: any[]; rankings: any[] };
  };
}

export function EditCollegeClient({ college, approvalRequest }: EditCollegeClientProps) {
  const router = useRouter();
  const [proposalVersion, setProposalVersion] = useState(approvalRequest?.updatedAt);

  // Basic Info Form States
  const [name, setName] = useState(college.name || "");
  const [shortName, setShortName] = useState(college.shortName || "");
  const [slug, setSlug] = useState(college.slug || "");
  const [uploads, setUploads] = useState(0);
  const onUploadBusy = (busy: boolean) => setUploads(count => count + (busy ? 1 : -1));
  const [logoUrl, setLogoUrl] = useState(college.logoUrl || "");
  const [coverImageUrl, setCoverImageUrl] = useState(college.coverImageUrl || "");
  const [brochurePdfUrl, setBrochurePdfUrl] = useState(college.brochurePdfUrl || "");
  const [ownershipType, setOwnershipType] = useState(college.ownershipType || "PUBLIC_GOVERNMENT");
  const [estYear, setEstYear] = useState(college.estYear ? String(college.estYear) : "");
  const [naacGrade, setNaacGrade] = useState(college.naacGrade || "");
  const [campusAreaAcres, setCampusAreaAcres] = useState(college.campusAreaAcres ? String(college.campusAreaAcres) : "");

  // Location & Contact
  const [city, setCity] = useState(college.city || "");
  const [state, setState] = useState(college.state || "");
  const [pincode, setPincode] = useState(college.pincode || "");
  const [fullAddress, setFullAddress] = useState(college.fullAddress || "");
  const [websiteUrl, setWebsiteUrl] = useState(college.websiteUrl || "");
  const [contactPhone, setContactPhone] = useState(college.contactPhone || "");
  const [contactEmail, setContactEmail] = useState(college.contactEmail || "");

  // Descriptions & Info
  const [overviewHtml, setOverviewHtml] = useState(college.overviewHtml || "");
  const [admissionHtml, setAdmissionHtml] = useState(college.admissionHtml || "");
  const [hostelInfo, setHostelInfo] = useState(college.hostelInfo || "");
  const [scholarshipInfo, setScholarshipInfo] = useState(college.scholarshipInfo || "");

  // Facilities & Gallery
  const initialFacilities: string[] = Array.isArray(college.facilitiesJson)
    ? (college.facilitiesJson as string[])
    : [];
  const [facilitiesText, setFacilitiesText] = useState(initialFacilities.join("\n"));
  const [galleryText, setGalleryText] = useState((college.galleryUrls || []).join("\n"));

  const [affiliatedTo, setAffiliatedTo] = useState(college.affiliatedTo || "");
  const [approvedBy, setApprovedBy] = useState((college.approvedBy || []).join(", "));

  // Q&A / FAQs Management
  const initialFaqs = Array.isArray(college.faqsJson)
    ? (college.faqsJson as Array<{ question: string; answer: string }>)
    : [];
  const [faqsList, setFaqsList] = useState<Array<{ question: string; answer: string }>>(initialFaqs);

  // SEO & Status
  const [metaTitle, setMetaTitle] = useState(college.metaTitle || "");
  const [metaDescription, setMetaDescription] = useState(college.metaDescription || "");
  const [isPublished, setIsPublished] = useState(college.isPublished);
  const [showInNavbar, setShowInNavbar] = useState(college.showInNavbar ?? false);
  const [navbarCategory, setNavbarCategory] = useState(college.navbarCategory || "");
  const [navbarSection, setNavbarSection] = useState(college.navbarSection || "featured");
  const [navbarFilter, setNavbarFilter] = useState(college.navbarFilter || defaultNavbarFilter(college.navbarCategory, college.navbarSection)?.id || "");

  // Status / Loading
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploads > 0) return;
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const facilitiesArray = facilitiesText
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    const galleryArray = galleryText
      .split("\n")
      .map((g) => g.trim())
      .filter(Boolean);

    try {
      const data = {
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
          faqsJson: faqsList,
          affiliatedTo: affiliatedTo.trim() || null,
          approvedBy: approvedBy.split(",").map(item => item.trim()).filter(Boolean),
          metaTitle: metaTitle.trim() || null,
          metaDescription: metaDescription.trim() || null,
          isPublished,
          showInNavbar,
          navbarCategory: navbarCategory || null,
          navbarSection,
          navbarFilter: navbarFilter || null,
        };
      const res = await fetch(approvalRequest
        ? `/api/v1/admin/approvals/${approvalRequest.id}`
        : `/api/v1/cms/colleges/${college.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(approvalRequest ? { data, expectedUpdatedAt: proposalVersion } : data),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        if (approvalRequest) {
          setProposalVersion(json.updatedAt);
          setSuccessMsg("Submission updated. Review the preview, then approve it when ready. Nothing has been published yet.");
        } else if (json.pendingApproval) {
          setSuccessMsg(
            "Your changes have been submitted to the Administrator for approval and will publish live once approved!"
          );
        } else {
          setSuccessMsg("College profile updated and synced successfully!");
        }
        router.refresh();
      } else {
        setErrorMsg(json.error || "Failed to update college details.");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      {!approvalRequest && <Link href={`/admin/colleges/${college.id}/data`} className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Manage courses, fees & placements</Link>}
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div className="flex items-center gap-3">
          <Link
            href={approvalRequest ? "/admin/approvals" : "/admin/colleges"}
            className="p-2 rounded-lg border hover:bg-accent text-muted-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">
              {approvalRequest ? "Edit Pending Submission" : "Edit College"}: {college.name}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure basic info, logos, gallery, contact details, fees, hostel, and SEO discovery tags.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={approvalRequest ? `/approval-preview/${approvalRequest.id}` : `/college/${slug}`}
            target="_blank"
            className="px-4 py-2 rounded-xl border bg-background hover:bg-accent text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{approvalRequest ? "Preview Submission" : "Preview Public Page"}</span>
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 text-xs bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Edit Form */}
      <CollegeSectionNavigation />
      <form id="college-profile-form" onSubmit={handleSubmit} className="space-y-6">
        
        {/* CARD 1: BASIC INFORMATION */}
        <div id="college-overview" className="scroll-mt-6 bg-card border rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wider text-muted-foreground border-b pb-2">
            <Building2 className="w-4 h-4 text-primary" />
            <span>1. Basic Institutional Profile</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold text-foreground mb-1">
                Full Official College Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background outline-hidden focus:border-primary font-medium"
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
                className="w-full px-3 py-2 border rounded-lg bg-background outline-hidden focus:border-primary"
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
                onChange={(e) => setSlug(e.target.value)}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                minLength={2}
                maxLength={80}
                title="Use lowercase words separated by hyphens, such as nit-rourkela. Enter the website in Website URL."
                className="w-full px-3 py-2 font-mono border rounded-lg bg-background outline-hidden focus:border-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">Use a name like nit-rourkela. Enter the external website in Website URL.</p>
            </div>

            <label className="block space-y-1"><span className="font-semibold text-muted-foreground">Affiliated university / board</span><input value={affiliatedTo} onChange={event => setAffiliatedTo(event.target.value)} className="w-full rounded-lg border bg-background p-2" /></label>
            <label className="block space-y-1"><span className="font-semibold text-muted-foreground">Approvals (comma separated)</span><input value={approvedBy} onChange={event => setApprovedBy(event.target.value)} className="w-full rounded-lg border bg-background p-2" /></label>
            <div>
              <label className="block font-semibold text-muted-foreground mb-1">
                Ownership Type
              </label>
              <select
                value={ownershipType}
                onChange={(e) => setOwnershipType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background"
              >
                <option value="PUBLIC_GOVERNMENT">Public / Government</option>
                <option value="PRIVATE">Private</option>
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
                className="w-full px-3 py-2 border rounded-lg bg-background outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground mb-1">
                NAAC Accreditation Grade
              </label>
              <select
                value={naacGrade}
                onChange={(e) => setNaacGrade(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background"
              >
                <option value="">Not specified</option>
                <option value="A++">A++ (Highest)</option>
                <option value="A+">A+</option>
                <option value="A">A</option>
                <option value="B++">B++</option>
                <option value="B+">B+</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="Not Accredited">Not Accredited</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground mb-1">
                Campus Area (in Acres)
              </label>
              <input
                type="number"
                step="0.1"
                value={campusAreaAcres}
                onChange={(e) => setCampusAreaAcres(e.target.value)}
                placeholder="e.g. 647"
                className="w-full px-3 py-2 border rounded-lg bg-background outline-hidden focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* CARD 2: MEDIA ASSETS (LOGOS & GALLERY) */}
        <div className="bg-card border rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wider text-muted-foreground border-b pb-2">
            <ImageIcon className="w-4 h-4 text-purple-600" />
            <span>2. Media Assets (Logo, Cover &amp; Gallery)</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <ImageUploadField label="College logo" values={logoUrl ? [logoUrl] : []} onChange={values => setLogoUrl(values[0] || "")} disabled={loading || uploads > 0} onBusyChange={onUploadBusy} />

            <ImageUploadField label="Campus cover photo" values={coverImageUrl ? [coverImageUrl] : []} onChange={values => setCoverImageUrl(values[0] || "")} disabled={loading || uploads > 0} onBusyChange={onUploadBusy} />

            <div className="sm:col-span-2">
              <label className="block font-semibold text-muted-foreground mb-1">
                Official Brochure PDF URL
              </label>
              <input
                type="url"
                value={brochurePdfUrl}
                onChange={(e) => setBrochurePdfUrl(e.target.value)}
                placeholder="https://example.com/brochure-2027.pdf"
                className="w-full px-3 py-2 border rounded-lg bg-background outline-hidden focus:border-primary"
              />
            </div>

            <div id="college-gallery" className="sm:col-span-2 scroll-mt-6">
              <ImageUploadField label="Campus gallery photos" multiple values={galleryText.split("\n").filter(Boolean)} onChange={values => setGalleryText(values.join("\n"))} disabled={loading || uploads > 0} onBusyChange={onUploadBusy} />
            </div>
          </div>
        </div>

        {/* CARD 3: LOCATION & CONTACT DETAILS */}
        <div className="bg-card border rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wider text-muted-foreground border-b pb-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span>3. Location &amp; Official Contact Information</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-foreground mb-1">City *</label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block font-bold text-foreground mb-1">State *</label>
              <input
                type="text"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground mb-1">Pincode</label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="e.g. 769008"
                className="w-full px-3 py-2 border rounded-lg bg-background outline-hidden focus:border-primary"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block font-semibold text-muted-foreground mb-1">
                Full Street Campus Address
              </label>
              <input
                type="text"
                value={fullAddress}
                onChange={(e) => setFullAddress(e.target.value)}
                placeholder="e.g. Sector 1, Rourkela, Sundargarh District, Odisha, India"
                className="w-full px-3 py-2 border rounded-lg bg-background outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground mb-1">Official Website</label>
              <input
                type="text"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="e.g. https://www.nitrkl.ac.in"
                className="w-full px-3 py-2 border rounded-lg bg-background outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground mb-1">Contact Phone Number</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="e.g. +91 661 2462020"
                className="w-full px-3 py-2 border rounded-lg bg-background outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground mb-1">Contact Email Address</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="e.g. admissions@nitrkl.ac.in"
                className="w-full px-3 py-2 border rounded-lg bg-background outline-hidden focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* CARD 4: OVERVIEW, ADMISSION & HOSTEL DETAILS */}
        <div className="bg-card border rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wider text-muted-foreground border-b pb-2">
            <GraduationCap className="w-4 h-4 text-emerald-600" />
            <span>4. Overview, Admission, Hostel &amp; Scholarships</span>
          </h2>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-foreground mb-1">
                Institutional Description &amp; Overview
              </label>
              <RichTextEditor label="Institutional overview" value={overviewHtml} onChange={setOverviewHtml} disabled={loading} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div id="college-admission" className="scroll-mt-6">
                <label className="block font-semibold text-muted-foreground mb-1">
                  Admission Procedure &amp; Eligibility Criteria
                </label>
                <RichTextEditor label="Admission procedure and eligibility" value={admissionHtml} onChange={setAdmissionHtml} disabled={loading} />
              </div>

              <div>
                <label className="block font-semibold text-muted-foreground mb-1">
                  Hostel Facilities &amp; Mess Details
                </label>
                <RichTextEditor label="Hostel and mess information" value={hostelInfo} onChange={setHostelInfo} disabled={loading} />
              </div>

              <div>
                <label className="block font-semibold text-muted-foreground mb-1">
                  Scholarships &amp; Financial Concessions
                </label>
                <RichTextEditor label="Scholarships and concessions" value={scholarshipInfo} onChange={setScholarshipInfo} disabled={loading} />
              </div>

              <div>
                <label className="block font-semibold text-muted-foreground mb-1">
                  Campus Facilities <span className="font-normal">(1 amenity per line)</span>
                </label>
                <textarea
                  rows={3}
                  value={facilitiesText}
                  onChange={(e) => setFacilitiesText(e.target.value)}
                  placeholder="Central Library&#10;Sports Arena&#10;Research Labs"
                  className="w-full p-3 text-xs border rounded-lg bg-background outline-hidden focus:border-primary"
                />
              </div>
            </div>
          </div>
        </div>

        <CollegeQuestionsEditor value={faqsList} onChange={setFaqsList} disabled={loading} />

        {/* CARD 5: SEO METADATA & PUBLISHING TOGGLE */}
        <div className="bg-card border rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wider text-muted-foreground border-b pb-2">
            <Globe className="w-4 h-4 text-primary" />
            <span>5. Search Engine Optimization (SEO &amp; GEO) &amp; Status</span>
          </h2>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-muted-foreground">Custom Meta Title</span>
                <span className="text-[11px] font-mono text-muted-foreground">{metaTitle.length}/60</span>
              </div>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder="e.g. NIT Rourkela Admissions 2027: Courses, Fees & Placements"
                className="w-full px-3 py-2 border rounded-lg bg-background outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-muted-foreground">Custom Meta Description</span>
                <span className="text-[11px] font-mono text-muted-foreground">{metaDescription.length}/160</span>
              </div>
              <textarea
                rows={2}
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                placeholder="Check verified details for NIT Rourkela..."
                className="w-full p-3 border rounded-lg bg-background outline-hidden focus:border-primary"
              />
            </div>

            {/* Publish Toggle */}
            <div className="p-4 rounded-xl border bg-muted/20 flex items-center justify-between">
              <div>
                <strong className="block text-foreground text-xs">Profile Publication Status</strong>
                <p className="text-[11px] text-muted-foreground">
                  When enabled, this college is indexed by search engines and displayed publicly to student visitors.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="rounded text-primary focus:ring-primary w-4 h-4"
                />
                <span className="font-bold text-xs text-foreground">
                  {approvalRequest ? (isPublished ? "Publish after approval" : "Keep as draft after approval") : (isPublished ? "PUBLISHED LIVE" : "DRAFT MODE")}
                </span>
              </label>
            </div>
          </div>
        </div>

      </form>
      {!approvalRequest && <>
        <p className="text-sm text-muted-foreground">Each section below saves its records separately. Profile changes use Save College Profile at the bottom.</p>
        {(["offerings", "placements"] as const).map(resource => <div key={resource} id={`college-${resource}`} className="scroll-mt-6"><AdminDataEditor resource={resource} collegeId={college.id} /></div>)}
        <CollegeReviewSection collegeId={college.id} />
        <CollegeBlogsSection collegeId={college.id} />
      </>}
      {approvalRequest && college.onboardingData && (["offerings", "placements"] as const).map(resource => <section key={resource} id={`college-${resource}`} className="scroll-mt-6 space-y-3 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-bold">{{ offerings: "Courses & Fees", placements: "Placements" }[resource]}</h2>
        <p className="text-sm text-muted-foreground">{college.onboardingData![resource].length} submitted record(s). These records are included when the college is approved. Use Preview Submission to inspect the public sections.</p>
      </section>)}
      {approvalRequest && <section id="college-blogs" className="rounded-xl border p-4 text-sm text-muted-foreground">College articles can be managed after this submission is approved.</section>}
      {approvalRequest && <section id="college-reviews" className="rounded-xl border p-4 text-sm text-muted-foreground">Reviews are managed after the college has been approved.</section>}
        <CollegeNavbarFields formId="college-profile-form" enabled={showInNavbar} category={navbarCategory} section={navbarSection} filter={navbarFilter} onFilterChange={setNavbarFilter} onSectionChange={setNavbarSection} onEnabledChange={setShowInNavbar} onCategoryChange={setNavbarCategory} />

        {/* BOTTOM ACTION BUTTONS */}
        <div className="admin-form-actions flex flex-wrap items-center justify-end gap-3 pt-3 border-t">
          <Link
            href={approvalRequest ? "/admin/approvals" : "/admin/colleges"}
            className="px-4 py-2.5 rounded-xl border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-colors"
          >
            Cancel
          </Link>

          <button
            type="submit"
            form="college-profile-form"
            disabled={loading || uploads > 0}
            className="px-6 py-2.5 rounded-xl font-bold text-xs text-white shadow-md flex items-center gap-2 hover:opacity-95 active:scale-98 transition-all cursor-pointer"
            style={{ background: "#1a3068" }}
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{approvalRequest ? "Save Submission Changes" : "Save College Profile"}</span>
              </>
            )}
          </button>
        </div>
    </div>
  );
}

