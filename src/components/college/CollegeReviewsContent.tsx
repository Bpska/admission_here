import { Star, ShieldCheck, ThumbsUp, ThumbsDown, User } from "lucide-react";
import { auth } from "@/lib/auth/config";
import Link from "next/link";
import { StudentReviewForm } from "@/components/public/StudentReviewForm";

import type { Prisma } from "@prisma/client";

export async function CollegeReviewsContent({ college, preview = false }: { college: Prisma.CollegeGetPayload<{ include: { reviews: { include: { user: { select: { name: true } } } } } }>; preview?: boolean }) {

  const session = await auth();
  const averages = ["ratingPlacements", "ratingInfra", "ratingFaculty", "ratingValueRoi"].map(key => college.reviews.length ? (college.reviews.reduce((sum, review) => sum + Number((review as any)[key]), 0) / college.reviews.length).toFixed(1) : "—");

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-foreground">
          {college.name} Student Reviews & Campus Feedback
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Verified student ratings across Placements, Faculty, Infrastructure, and ROI.
        </p>
      </div>

      {/* Rating Breakdown Hero */}
      <div className="p-6 rounded-2xl bg-card border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="text-center sm:text-left">
          <span className="text-4xl sm:text-5xl font-extrabold text-foreground block">
            {college.ratingOverall.toFixed(1)}
          </span>
          <div className="flex items-center justify-center sm:justify-start gap-1 my-1.5 text-amber-500">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-amber-500" />
            ))}
          </div>
          <span className="text-xs text-muted-foreground block">
            Based on {college.reviewCount || college.reviews.length} audited student reviews
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs w-full sm:w-auto">
          <div className="p-3 rounded-xl bg-muted/40 border">
            <span className="text-muted-foreground block text-[11px]">Placements</span>
            <span className="font-bold text-foreground">{averages[0]} / 5.0</span>
          </div>
          <div className="p-3 rounded-xl bg-muted/40 border">
            <span className="text-muted-foreground block text-[11px]">Infrastructure</span>
            <span className="font-bold text-foreground">{averages[1]} / 5.0</span>
          </div>
          <div className="p-3 rounded-xl bg-muted/40 border">
            <span className="text-muted-foreground block text-[11px]">Faculty & Research</span>
            <span className="font-bold text-foreground">{averages[2]} / 5.0</span>
          </div>
          <div className="p-3 rounded-xl bg-muted/40 border">
            <span className="text-muted-foreground block text-[11px]">Value for Money (ROI)</span>
            <span className="font-bold text-emerald-600">{averages[3]} / 5.0</span>
          </div>
        </div>
      </div>

      {/* Review Cards */}
      {!preview && ((session?.user as any)?.role === "STUDENT" ? <StudentReviewForm collegeId={college.id} /> : <Link href={`/login?callbackUrl=${encodeURIComponent(`/college/${college.slug}/reviews`)}`} className="inline-flex rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm">Sign in as a student to write a review</Link>)}
      {college.reviews.length === 0 && <p className="text-sm text-muted-foreground">No approved reviews yet. Share your campus experience above.</p>}
      <div className="space-y-4">
        {college.reviews.map((r) => (
          <div key={r.id} className="p-6 rounded-2xl border bg-card shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm sm:text-base text-foreground">{r.title}</h4>
                  {r.isVerified && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      <ShieldCheck className="w-3 h-3" /> Verified Student ID
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  By {r.user.name} • {r.courseName} (Class of {r.batchYear})
                </p>
              </div>

              <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-700">
                ★ {r.ratingOverall.toFixed(1)}
              </span>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <span className="font-bold text-emerald-700 flex items-center gap-1.5 mb-1">
                  <ThumbsUp className="w-3.5 h-3.5" /> What Students Like (Pros):
                </span>
                <p className="text-foreground/90">{r.prosText}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-red-500/5 border border-red-500/20">
                <span className="font-bold text-red-600 flex items-center gap-1.5 mb-1">
                  <ThumbsDown className="w-3.5 h-3.5" /> Areas for Improvement (Cons):
                </span>
                <p className="text-foreground/90">{r.consText}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
