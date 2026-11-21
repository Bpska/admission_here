"use client";
import { useState } from "react";
import { AdminDataEditor } from "./AdminDataEditor";
import { ADMIN_RESOURCES } from "@/lib/admin-data-config";

export function CollegeDataManager({ collegeId }: { collegeId: string }) {
  const [resource, setResource] = useState("offerings");
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2">{["offerings", "placements"].map(key => <button key={key} type="button" aria-pressed={resource === key} onClick={() => setResource(key)} className={`rounded-lg border px-4 py-2 text-sm ${resource === key ? "bg-primary text-primary-foreground" : "bg-card"}`}>{ADMIN_RESOURCES[key].label}</button>)}</div>
    <p className="text-sm text-muted-foreground">Add each programme under this college once. Its fees, eligibility, overview, admission and placement notes appear on its own programme page. Amounts are in rupees.</p>
    <AdminDataEditor key={resource} resource={resource} collegeId={collegeId} />
  </div>;
}
