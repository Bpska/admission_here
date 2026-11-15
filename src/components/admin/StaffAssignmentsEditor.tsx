"use client";
import { useEffect, useState } from "react";
export function StaffAssignmentsEditor() {
  const [staff, setStaff] = useState<{ id: string; name: string; assignedCollegeIds: string[] }[]>([]);
  const [colleges, setColleges] = useState<{ id: string; name: string }[]>([]);
  const [id, setId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => { fetch("/api/v1/admin/staff").then(async response => { if (!response.ok) throw new Error("Unable to load staff assignments."); return response.json(); }).then(data => { setStaff(data.staff); setColleges(data.colleges); }).catch(error => setError(error.message)); }, [reload]);
  return <section className="border rounded-xl p-5 bg-card space-y-4"><h2 className="text-lg font-bold">Assigned colleges</h2><p className="text-sm text-muted-foreground">Staff can view and propose changes only for their assigned colleges. Accounts with no assigned colleges cannot view college-specific records.</p>
    <button type="button" onClick={() => setReload(value => value + 1)} className="text-sm text-primary underline">Refresh staff list</button>
    <label className="block text-sm">Staff member<select aria-label="Staff assignment member" value={id} onChange={event => { setId(event.target.value); setSelected(staff.find(member => member.id === event.target.value)?.assignedCollegeIds || []); setMessage(""); }} className="block w-full border rounded-lg p-2"><option value="">Select staff member</option>{staff.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
    {id && <form onSubmit={async event => { event.preventDefault(); setBusy(true); setError(""); setMessage(""); try { const response = await fetch("/api/v1/admin/staff", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, assignedCollegeIds: selected }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setStaff(items => items.map(item => item.id === id ? { ...item, assignedCollegeIds: selected } : item)); setMessage("Assigned colleges saved. Access updates immediately."); } catch (error) { setError(error instanceof Error ? error.message : "Unable to save assignments"); } finally { setBusy(false); } }} className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-2">{colleges.map(college => <label key={college.id} className="flex gap-2 items-center text-sm"><input type="checkbox" checked={selected.includes(college.id)} onChange={event => setSelected(ids => event.target.checked ? [...ids, college.id] : ids.filter(value => value !== college.id))} />{college.name}</label>)}</div>
      <button disabled={busy} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm">{busy ? "Saving…" : "Save assigned colleges"}</button>
    </form>}
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
