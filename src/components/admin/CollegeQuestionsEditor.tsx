"use client";
export type CollegeQuestion = { question: string; answer: string };
export function CollegeQuestionsEditor({ value, onChange, disabled = false }: { value: CollegeQuestion[]; onChange: (value: CollegeQuestion[]) => void; disabled?: boolean }) {
  return <section id="college-qna" className="scroll-mt-6 space-y-4 rounded-2xl border bg-card p-6">
    <div className="flex justify-between gap-3"><h2 className="text-lg font-bold">Q&A / Frequently asked questions</h2><button type="button" disabled={disabled} className="text-sm text-primary" onClick={() => onChange([...value, { question: "", answer: "" }])}>Add question</button></div>
    {value.length === 0 && <p className="text-sm text-muted-foreground">Add verified questions and answers for this college.</p>}
    {value.map((item, index) => <div key={index} className="space-y-2 rounded-lg border p-3">
      <label className="block space-y-1 text-xs font-semibold"><span>Question {index + 1}</span><input required disabled={disabled} value={item.question} onChange={event => onChange(value.map((row, position) => position === index ? { ...row, question: event.target.value } : row))} className="w-full rounded-lg border bg-background p-2 text-sm" /></label>
      <label className="block space-y-1 text-xs font-semibold"><span>Answer</span><textarea required disabled={disabled} rows={3} value={item.answer} onChange={event => onChange(value.map((row, position) => position === index ? { ...row, answer: event.target.value } : row))} className="w-full rounded-lg border bg-background p-2 text-sm" /></label>
      <button type="button" disabled={disabled} className="text-xs text-red-600" onClick={() => onChange(value.filter((_, position) => position !== index))}>Remove question</button>
    </div>)}
  </section>;
}
