import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { generateFaqJsonLd } from "@/lib/seo/json-ld";
import { HelpCircle, ChevronDown } from "lucide-react";

import type { Prisma } from "@prisma/client";

export function CollegeQnaContent({ college }: { college: Prisma.CollegeGetPayload<{}> }) {


  const faqs = Array.isArray(college.faqsJson) ? college.faqsJson as Array<{ question: string; answer: string }> : [];
  const faqJsonLd = generateFaqJsonLd(faqs);

  return (
    <div className="space-y-6 max-w-4xl">
      <JsonLdScript data={faqJsonLd} />

      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-foreground">
          {college.name} Frequently Asked Questions (Q&A)
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Verified answers regarding admissions eligibility, cutoff criteria, fees, and campus hostels.
        </p>
      </div>

      {faqs.length === 0 && <p className="text-sm text-muted-foreground">Questions and answers have not been added yet.</p>}
      <div className="space-y-4">
        {faqs.map((faq, idx) => (
          <div key={idx} className="p-5 rounded-2xl border bg-card shadow-xs space-y-2">
            <h3 className="font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-primary shrink-0" />
              <span>{faq.question}</span>
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-6">
              {faq.answer}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
