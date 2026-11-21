import { formatInr } from "@/lib/utils";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { generateCourseJsonLd } from "@/lib/seo/json-ld";
import { BookOpen, IndianRupee, FileText } from "lucide-react";

import type { Prisma } from "@prisma/client";

export function CollegeCoursesContent({ college }: { college: Prisma.CollegeGetPayload<{ include: { courses: { include: { course: true } } } }> }) {


  const coursesJsonLd = college.courses.map((c) =>
    generateCourseJsonLd({
      courseName: c.specialization,
      degree: c.course.degree,
      collegeName: college.name,
      totalFeesInr: c.totalFeesInr,
      durationYrs: c.course.durationYrs,
      slug: college.slug,
    })
  );

  return (
    <div className="space-y-6">
      <JsonLdScript data={coursesJsonLd} />

      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-foreground">
          {college.name} Courses & Fee Structure 2027
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Detailed tuition fees, hostel expenses, seat intake, and eligibility criteria for all programs.
        </p>
      </div>

      <div className="bg-card border rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">Degree & Specialization</th>
                <th className="p-4">Duration</th>
                <th className="p-4">Total Tuition Fees</th>
                <th className="p-4">1st Year Fees</th>
                <th className="p-4">Intake Seats</th>
                <th className="p-4">Accepted Exams</th>
              </tr>
            </thead>
            <tbody className="divide-y text-foreground">
              {college.courses.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4">
                    <span className="font-bold block text-sm">
                      {c.course.degree} in {c.specialization}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Level: {c.course.level}
                    </span>
                  </td>
                  <td className="p-4 font-medium">{c.course.durationYrs ? `${c.course.durationYrs} Years` : "Not specified"}</td>
                  <td className="p-4 font-bold text-sm text-primary">
                    {c.totalFeesInr == null ? "Not published" : formatInr(c.totalFeesInr)}
                    {c.publishedFeeInr != null && <div className="mt-2 space-y-1 text-xs font-normal text-muted-foreground"><p>Published {c.feeAcademicYear || ""} amount: {formatInr(c.publishedFeeInr)}{c.publishedCreditFeeInr != null && c.publishedCreditFeeInr !== c.publishedFeeInr ? ` (credit-card category: ${formatInr(c.publishedCreditFeeInr)})` : ""}</p>{c.feeBasis && <p>{c.feeBasis}</p>}{c.feeSourceUrl && <a href={c.feeSourceUrl} target="_blank" rel="noreferrer" className="underline">Official fee document</a>}</div>}
                  </td>
                  <td className="p-4 font-medium">
                    {c.firstYearFeesInr ? formatInr(c.firstYearFeesInr) : "—"}
                  </td>
                  <td className="p-4 font-semibold">{c.intakeSeats || "N/A"} Seats
                    {(c.eligibilityCriteria as { intakeYear?: string })?.intakeYear && <span className="mt-1 block text-[11px] font-normal text-muted-foreground">Approved {(c.eligibilityCriteria as { intakeYear?: string }).intakeYear}</span>}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {c.acceptedExamSlugs.map((exam) => (
                        <span
                          key={exam}
                          className="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold uppercase text-[10px]"
                        >
                          {exam.replace("-", " ")}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
