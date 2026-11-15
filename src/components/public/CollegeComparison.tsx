"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { CompareBar } from "./CompareBar";
import type { CollegeCardData } from "./CollegeCard";
type Selection = Pick<CollegeCardData, "id" | "slug" | "name" | "shortName">;
const Context = createContext<{selected: Selection[]; toggle: (college: CollegeCardData) => void} | null>(null);
export const useCollegeComparison = () => useContext(Context);
export function CollegeComparison({children}: {children: React.ReactNode}) {
  const [selected, setSelected] = useState<Selection[]>([]);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { try { const value = JSON.parse(localStorage.getItem("college-comparison") || "[]"); if (Array.isArray(value)) setSelected(value.filter(c => typeof c.id === "string" && typeof c.slug === "string" && typeof c.name === "string").slice(0,4)); } catch {} setReady(true); }, []);
  useEffect(() => { if (ready) { try { localStorage.setItem("college-comparison", JSON.stringify(selected)); } catch {} } }, [selected, ready]);
  function toggle(college: CollegeCardData) {
    setMessage("");
    if (selected.some(c => c.id === college.id)) setSelected(selected.filter(c => c.id !== college.id));
    else if (selected.length >= 4) setMessage("Compare up to four colleges. Remove one to add another.");
    else setSelected([...selected, {id: college.id, slug: college.slug, name: college.name, shortName: college.shortName}]);
  }
  return <Context.Provider value={{selected,toggle}}>{children}{selected.length > 0 && <div className="h-40" />}{message && <div role="status" className="fixed bottom-48 left-4 right-4 z-40 rounded-lg bg-background border p-3 shadow-lg" onClick={() => setMessage("")}>{message}</div>}<CompareBar selectedColleges={selected} onRemove={id => {setSelected(selected.filter(c => c.id !== id));setMessage("");}} onClear={() => {setSelected([]);setMessage("");}} /></Context.Provider>;
}
