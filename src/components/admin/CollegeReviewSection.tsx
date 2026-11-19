"use client";
import { useEffect, useState } from "react";
import { ReviewModerationClient } from "@/app/(admin)/admin/reviews/ReviewModerationClient";

export function CollegeReviewSection({ collegeId }: { collegeId: string }) {
  const [reviews, setReviews] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch(`/api/v1/cms/college-reviews?collegeId=${encodeURIComponent(collegeId)}`).then(async response => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Unable to load reviews.");
      if (active) setReviews(data.reviews);
    }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [collegeId]);
  return <section id="college-reviews" className="scroll-mt-6 space-y-4 rounded-xl border bg-card p-6">
    <h2 className="text-lg font-bold">Reviews</h2>
    <p className="text-sm text-muted-foreground">Manage student-submitted reviews for this college. Approving a review updates the public rating.</p>
    {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : reviews === null ? <p role="status">Loading reviews…</p> : reviews.length ? <ReviewModerationClient initialReviews={reviews} /> : <p className="text-sm text-muted-foreground">No student reviews have been submitted yet.</p>}
  </section>;
}
