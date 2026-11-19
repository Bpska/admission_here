import { CheckCircle2, Calendar, FileText, ArrowRight } from "lucide-react";

import type { Prisma } from "@prisma/client";

export function CollegeAdmissionContent({ college }: { college: Prisma.CollegeGetPayload<{}> }) {


  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-foreground">
          {college.name} Admission Process 2026
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Institution-published admission information. Confirm current eligibility, application dates and selection requirements with the institute.
        </p>
      </div>

      {college.admissionHtml ? (
        <div
          className="prose prose-slate dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed p-6 bg-card border rounded-2xl shadow-xs"
          dangerouslySetInnerHTML={{ __html: college.admissionHtml }}
        />
      ) : (
        <div className="bg-card border rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs">
          <h3 className="font-bold text-base text-foreground">Admissions Overview</h3>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Verified admission requirements have not been added for {college.name}. Contact the institute for current programme eligibility, entrance examinations and application instructions.
          </p>
        </div>
      )}

      {/* Step-by-Step Flow */}
      <div className="bg-card border rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
        <h3 className="font-bold text-base text-foreground">
          Confirming Your Admission
        </h3>

        <div className="space-y-4">
          {[
            {
              step: "1",
              title: "Entrance Exam Qualification",
              desc: "Confirm which entrance examination, qualifying marks or other entry conditions apply to your chosen programme.",
            },
            {
              step: "2",
              title: "Official Application",
              desc: `Use the official application route specified by ${college.name}; check whether a counselling registration is also required.`,
            },
            {
              step: "3",
              title: "Seat Allotment & Document Verification",
              desc: "Confirm the selection decision, required documents, fees and payment deadlines with the institute or relevant counselling authority.",
            },
            {
              step: "4",
              title: "Physical Campus Reporting",
              desc: "Follow the reporting instructions given in your admission offer and retain copies of submitted documents and payment receipts.",
            },
          ].map((s) => (
            <div key={s.step} className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center shrink-0">
                {s.step}
              </div>
              <div>
                <h4 className="font-bold text-sm text-foreground">{s.title}</h4>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
