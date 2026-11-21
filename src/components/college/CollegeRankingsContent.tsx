import { ShieldCheck, Trophy } from "lucide-react";

import type { Prisma } from "@prisma/client";

export function CollegeRankingsContent({ college }: { college: Prisma.CollegeGetPayload<{ include: { rankings: true } }> }) {


  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-foreground">
          {college.name} Rankings & Accreditations 2027
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Institutional rankings and accreditation details.
        </p>
      </div>

      {(college.nirfRank || college.naacGrade) && <div className={`grid gap-4 ${college.nirfRank && college.naacGrade ? "sm:grid-cols-2" : ""}`}>
        {college.nirfRank && <section aria-label="NIRF ranking" className="flex items-center gap-4 rounded-2xl border bg-card p-6 shadow-xs">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-xl font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">#{college.nirfRank}</div>
          <div><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ministry of Education, Govt. of India</p><h3 className="mt-1 text-lg font-bold">NIRF Ranking</h3></div>
        </section>}
        {college.naacGrade && <section aria-label="NAAC accreditation" className="flex items-center gap-4 rounded-2xl border bg-card p-6 shadow-xs">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><ShieldCheck className="h-7 w-7" /></div>
          <div><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Accreditation</p><h3 className="mt-1 text-lg font-bold">NAAC Grade {college.naacGrade}</h3></div>
        </section>}
      </div>}

      {/* Rankings Table */}
      {college.rankings.length > 0 && <div className="bg-card border rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 bg-muted/40 border-b">
          <h3 className="font-bold text-sm text-foreground">
            Historical Ranking Benchmarks
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">Agency / Publisher</th>
                <th className="p-4">Category</th>
                <th className="p-4">Year</th>
                <th className="p-4">National Rank</th>
                <th className="p-4">Out of Total Colleges</th>
              </tr>
            </thead>
            <tbody className="divide-y text-foreground">
              {college.rankings.map((r) => (
                <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4 font-bold flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span>{r.agencyName}</span>
                  </td>
                  <td className="p-4">{r.category}</td>
                  <td className="p-4 font-semibold">{r.rankingYear}</td>
                  <td className="p-4 font-extrabold text-sm text-amber-600">
                    #{r.rankNumber}
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {r.outOfTotal ? `Top ${r.outOfTotal}` : "National Pool"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  );
}
