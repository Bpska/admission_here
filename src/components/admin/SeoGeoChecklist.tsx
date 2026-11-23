"use client";
import { CheckCircle2, CircleAlert, Info, ListChecks } from "lucide-react";
import { analyzeBlogContent, topicAppears } from "@/lib/blog-readability";
import { useEffect, useMemo, useState } from "react";

interface Props {
  title: string;
  metaTitle: string;
  metaDescription: string;
  content: string;
  featuredImageUrl: string;
  hasShortcodes: boolean;
  tags: string[];
  faqCount: number;
}
export function SeoGeoChecklist({
  title,
  metaTitle,
  metaDescription,
  content,
  featuredImageUrl,
  hasShortcodes,
  tags,
  faqCount,
}: Props) {
  const [origin, setOrigin] = useState(process.env.NEXT_PUBLIC_APP_URL || "https://admissionshub.in");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const analysis = useMemo(() => analyzeBlogContent(content, origin), [content, origin]);
  const effectiveTitle = metaTitle.trim() || title.trim();
  const missingAlt = analysis.images.filter((image) => !image.alt).length;
  const topic = tags[0] || "";
  const checks = [
    {
      label: "Descriptive search title",
      passed: effectiveTitle.length >= 15 && effectiveTitle.length <= 70,
      detail: `${effectiveTitle.length} characters. Keep it specific and concise; display width varies.`,
    },
    {
      label: "Search description",
      passed:
        metaDescription.trim().length >= 70 &&
        metaDescription.trim().length <= 170,
      detail: metaDescription.trim()
        ? `${metaDescription.trim().length} characters. Summarize what readers will learn.`
        : "Write a useful summary or use Suggest from article.",
    },
    {
      label: "Clear opening paragraph",
      passed: analysis.intro.length >= 80,
      detail: analysis.intro
        ? "Answer the reader’s main question early and verify any claims."
        : "Start with a short introduction to the topic.",
    },
    {
      label: "Scannable headings",
      passed:
        analysis.headings.some((heading) => heading.level === 2) &&
        !analysis.headings.some((heading) => heading.level === 1),
      detail: `${analysis.headings.filter((heading) => heading.level === 2).length} H2 sections. Use H2/H3 in the body; the article title supplies H1.`,
    },
    {
      label: "Related internal links",
      passed: analysis.internalLinks > 0 || hasShortcodes,
      detail: `${analysis.internalLinks} body link(s)${hasShortcodes ? " and a linked college card" : ""}. Link to relevant college pages or articles.`,
    },
    {
      label: "External reference links",
      passed: analysis.externalLinks > 0,
      detail: `${analysis.externalLinks} external link(s). Cite official sources for dates, fees and eligibility; check them before publishing.`,
    },
    {
      label: "Cover for social sharing",
      passed: !!featuredImageUrl.trim(),
      detail: featuredImageUrl.trim()
        ? "A cover is selected. Choose a clear, relevant picture."
        : "Upload a relevant cover for article and social previews.",
    },
    {
      label: "Image descriptions",
      passed:
        missingAlt === 0 &&
        (!!featuredImageUrl.trim() || analysis.images.length > 0),
      detail: analysis.images.length
        ? `${missingAlt} of ${analysis.images.length} body picture(s) need alt text. Describe the picture in Add pictures.`
        : "Body pictures can have descriptions in Add pictures; the cover uses the article title.",
    },
  ];
  const passed = checks.filter((check) => check.passed).length;
  const score = Math.round((passed / checks.length) * 100);
  return (
    <section
      aria-label="SEO and reader checks"
      className="rounded-xl border bg-card p-5 space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <ListChecks className="h-4 w-4 text-primary" />
          SEO &amp; reader checks
        </h2>
        <span
          className={`text-lg font-bold ${score >= 75 ? "text-emerald-600" : "text-amber-600"}`}
        >
          {score}/100
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {passed} of {checks.length} editorial checks complete. This is a writing
        guide, not a search ranking score.
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="rounded-lg bg-muted/40 p-2">
          {analysis.wordCount} words
        </span>
        <span className="rounded-lg bg-muted/40 p-2">
          {analysis.readingMinutes} min read
        </span>
      </div>
      <ul className="space-y-3">
        {checks.map((check) => (
          <li key={check.label} className="flex items-start gap-2 text-xs">
            {check.passed ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            )}
            <div>
              <p className="font-semibold">{check.label}</p>
              <p className="mt-0.5 text-muted-foreground">{check.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="space-y-2 border-t pt-3 text-xs">
        <p className="font-semibold">Topic coverage</p>
        {topic ? (
          <>
            <p className="text-muted-foreground">
              Main topic from your first tag:{" "}
              <strong className="text-foreground">{topic}</strong>
            </p>
            <p>
              {[
                ["title", effectiveTitle],
                ["introduction", analysis.intro],
                ["description", metaDescription],
              ]
                .map(
                  ([label, text]) =>
                    `${label}: ${topicAppears(text, topic) ? "mentioned" : "review"}`,
                )
                .join(" · ")}
            </p>
            <p className="text-muted-foreground">
              Use natural wording. Do not repeat keywords just to satisfy a
              check.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">
            Add your main topic as the first tag to check its coverage.
          </p>
        )}
        <p className="flex gap-2 pt-2 text-muted-foreground">
          <Info className="h-4 w-4 shrink-0" />
          {faqCount} complete FAQ(s). Two or more section headings create a
          reader contents menu automatically. Sharing is available on published
          articles.
        </p>
        <a
          href="https://developers.google.com/search/docs/fundamentals/seo-starter-guide"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-primary underline"
        >
          Google’s SEO guidance
        </a>
      </div>
    </section>
  );
}
