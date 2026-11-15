# Full website audit — 14 November 2026

**Assessment: the core application builds and its existing regression workflows pass, but the audited version has release-blocking security issues and several broken public experiences.** This was an audit, not a repair pass. No application feature code was changed or deployed.

## Scope and evidence

Audited the current working tree and connected local database, rather than only committed files. Existing user changes were preserved.

- Crawled **123 distinct URL/query combinations** across the public sitemap, header/footer destinations and invalid-input cases. The first crawl included all **70 sitemap entries**. These counts include redirects and deliberate negative tests; they are not counts of working pages.
- Inspected **19 authenticated admin/partner screens** in real Chrome. Checked six public and six admin/partner mobile layouts at **390 × 844**; none of those samples had document-level horizontal overflow.
- Exercised public search opening/Escape, mobile navigation, comparison selection/navigation, and apply/brochure dialog opening in Chrome. Reviewed all **129 native button declarations**.
- Re-ran the existing suites: **26 admin**, **18 portal**, and **7 export** checks passed. One export attempt had a temporary authentication failure while other checks ran; its isolated rerun passed all seven. An early comparison probe clicked the same selection twice; a corrected probe successfully navigated to the comparison page. Neither harness problem is counted as a website defect.
- `npx tsc --noEmit --incremental false` passed. An isolated copy passed `npm run build`, including production compilation, type validation and static generation. Production responses also reproduced the invalid-input errors.
- `npm run lint` did **not** pass: it requested interactive ESLint setup and exited without checking the code.
- Used temporary, uniquely named records for security and access checks. They were removed afterward. No original college, blog, account or lead was edited.

Development checks used localhost:3001. The isolated production build used localhost:3002. The live deployment was not inspected. Evidence is stored in [audit/2026-11-14](audit/2026-11-14/); those artifacts contain no session cookies or passwords.

## Findings, ordered by priority

### Critical / high

| ID | Priority | Finding and evidence | Required correction |
| --- | --- | --- | --- |
| S01 | Critical before deployment | **Public demo Super Admin credentials.** `/login` offers a Super Admin test-account button and fills a fixed password in client code. The local seeded administrator accepts those credentials, as demonstrated by the authenticated regression suites. The UI has no production-only restriction. Sources: `src/app/login/page.tsx:49`, `:136`, and `prisma/seed.ts`. Production account state was not tested. | Remove privileged demo access from public builds, rotate seeded privileged credentials, and review existing privileged sessions before deployment. |
| S02 | High | **Stored JavaScript injection in published articles.** A temporary AUTHOR authenticated, published an article through the normal CMS endpoint with an HTML image event handler, and visiting that article in Chrome executed the handler. The proof only set a harmless document flag. `RichBlogRenderer` injects unsanitized HTML; CMS schemas accept it. Live-update HTML, college/exam HTML and approval previews have related unfiltered sinks. `JsonLdScript` also inserts `JSON.stringify(data)` without escaping `<`, so it needs a separate safe-serialization review. | Sanitize permitted HTML with an allowlist, strip executable attributes/URLs, escape JSON-LD script content, and add regression coverage for public rendering and staff previews. A CSP is additional protection. |
| S03 | High | **Known fallback cache-invalidation secret is active locally.** `REVALIDATION_SECRET` is absent from the local configuration, so `src/app/api/v1/revalidate/route.ts:8` uses a fixed source-code secret. Anyone knowing it can request cache invalidation. This finding is based on the configuration and handler; no invalidation request was sent. | Require a strong configured secret, fail closed when absent, and validate allowed paths/tags. |
| S04 | High, needs dependency triage | **npm reports 13 affected dependency entries: 10 high, 3 moderate.** The report includes direct packages `ai`, `zod`, `prisma`, `next`, and `exceljs`, with transitive findings. These counts include dependency chains and are not 13 independently demonstrated exploits. | Review advisories and reachable code, then upgrade or remove affected dependencies with compatibility checks. Do not blindly apply forced major upgrades. See [npm-audit.json](audit/2026-11-14/npm-audit.json). |

### Functional, content and privacy defects

| ID | Priority | Finding and evidence | Required correction |
| --- | --- | --- | --- |
| F01 | Medium | **Eight header/footer destinations are missing.** `/privacy`, `/terms`, `/editorial-standards`, `/exams/gate`, `/exams/ojee`, `/exams/cuet-ug`, `/blog/top-10-mba-colleges-in-india-cat-cutoffs-placements`, and `/blog/neet-ug-2026-counseling-dates-seat-matrix-breakdown`. Three policy URLs return HTTP 404. Some streamed missing exam/blog pages initially return HTTP 200 but render the not-found view; status alone is insufficient. | Create the destinations or remove/replace their links. Publish actual policy content matching the website’s handling of student/contact information. |
| F02 | Medium | **Invalid URL inputs crash pages.** Chrome showed “Application error: a server-side exception” for `/colleges?ownership=INVALID`, `/colleges?maxFees=abc`, and `/blog/category/INVALID`. Production responses contain server-error digests too. Invalid enum values and `NaN` reach Prisma. | Validate/normalize query values and categories before database calls. Return a controlled empty/error state or not-found page. |
| F03 | Medium | **Wrong destinations behind valid labels.** Footer M.Tech → B.Tech, BDS → MBBS, BBA → MBA; CUET PG → CUET UG and JEE Advanced → JEE Main. Header XAT/MAT labels also point to CAT. Several specialization links discard the advertised specialization. Sources: `Footer.tsx` and `Navbar.tsx`. | Use matching degree/exam/specialization filters or explicitly label a broader destination. |
| F04 | Medium | **Counselor returns unrelated results.** With the drawer defaults, “IIT Bombay” returns IIT Bhubaneswar because query tokens use OR matching while the default home state restricts results to Odisha. A deliberately unmatched query returns five top colleges because zero matches silently removes the query filter. Verified through API responses. | Preserve named-college relevance, treat home state as user context rather than an unconditional location restriction, and return an explicit no-match result instead of unrelated defaults. |
| F05 | Medium | **Partner fee submission and brochure upload are unfinished.** “Submit Updates for Verification” has no click handler/form action; the advertised upload area has no file input, drop handler or upload implementation. `src/app/(partner)/partner/[collegeId]/profile/page.tsx:85`, `:110`. | Implement persisted proposals and upload handling, or remove the controls until available. |
| F06 | Medium | **Unpublished college metadata is public.** A temporary unpublished college with a course appeared in anonymous `/api/v1/courses/hierarchy` results. `offerings` lacks `college.isPublished` filtering. Its public profile remains protected, but its ID, name and related metadata leak through this API. | Filter unpublished offerings before applying the six-item cap, and invalidate existing hierarchy caches. |
| F07 | Medium | **Blog college insertion always uses NIT Rourkela.** Both the default article and “+ College CTA” insert `nit-rourkela`. Existing published data has two posts embedding NIT Rourkela and one embedding IIT Bombay; the data does not support saying literally every post uses one college. | Add an explicit college picker and remove institution-specific defaults. |
| F08 | Medium | **Blog editor uses literal `\\n` characters.** Default summary joining, default article text, shortcode insertion and summary splitting use escaped backslash-n strings rather than actual line breaks. Chrome confirmed literal newline escape sequences in the default editor fields. Manually entered line breaks therefore do not follow the same parsing rules as the defaults. `BlogMdxEditor.tsx:45–64`, plus save parsing. | Use actual line breaks consistently in editing, shortcode insertion, summary parsing and preview rendering. |
| F09 | Medium | **Public metrics exceed the actual catalog.** Homepage text claims 1,000+ institutions and 50,000+ cutoff ranks. The inspected database contains six published colleges and six cutoff rows. Two colleges have no course mappings, and published test college/blog entries are visible. | Derive metrics from records and mark incomplete/demo content appropriately before launch. Existing test content was left unchanged. |
| F10 | Medium | **Changing sidebar filters loses path-based degree/state filters.** On a path such as `/colleges/mba`, the sidebar reads only query parameters and navigates to `/colleges?...`, dropping the MBA path constraint. This is confirmed by source tracing, not a separate browser mutation test. | Normalize the current path and query into a shared filter state and preserve all active constraints. |
| F11 | Medium | **Directory silently stops at 24 colleges.** `take: 24` is fixed, `page` is accepted but never used, and there is no pagination. This is a source-confirmed limit; the current six-record catalog does not reach it. | Implement pagination/load-more with a total count or explicitly cap the product and label it. |
| F12 | Medium | **“OTP Verified” partner metric is not OTP verification.** It counts every lead whose status differs from NEW, including counselor workflow changes. No OTP flow establishes that metric in the audited code. `src/app/(partner)/partner/[collegeId]/page.tsx:97`. | Track a real verification event or rename the metric to reflect lead status. |
| F13 | Low | **Review graphic always shows five filled stars.** The numeric rating may be zero or lower than five, but `reviews/page.tsx` fills all five icons unconditionally. | Render stars from the actual rating and distinguish no reviews from a zero rating. |
| F14 | Low | **Blog rendering supports only a small Markdown subset.** The renderer handles basic headings, paragraphs and simple unordered lists, but does not parse ordinary Markdown links, emphasis, ordered lists or full MDX. Raw HTML is injected instead. | Define the supported content format and use a suitable parser with HTML sanitization. |

### SEO, accessibility and operational readiness

| ID | Priority | Finding and evidence | Required correction |
| --- | --- | --- | --- |
| Q01 | Medium | **College tab metadata duplicates the overview.** Sampled IIT Bombay courses/fees, admission, cutoff, placements, rankings, gallery, reviews and Q&A all use the overview title and canonical URL, although the sitemap lists them separately. | Choose a consistent indexing strategy; provide distinct metadata and self-canonicals if tabs are intended to be indexed separately. |
| Q02 | Low | **Sitemap includes redirect aliases.** Six `/colleges/{college-slug}` aliases are listed alongside canonical `/college/{slug}` profiles. The aliases redirect. `src/app/sitemap.ts`. | List canonical destinations rather than redirect aliases. |
| Q03 | Medium | **Default social images are missing.** `/images/og-default.jpg` and `/images/og-blog.jpg` return 404; metadata/schema reference them. | Supply valid image assets or update metadata to existing images. |
| Q04 | Medium | **Unknown predictor exams render as real pages.** `/college-predictor/nonexistent-audit-exam` renders an indexable predictor page titled with the unknown slug. The API later rejects the exam. | Call `notFound()` when the page’s exam lookup fails. |
| Q05 | Medium | **Apply dialog is inaccessible in key ways.** Chrome found no dialog role, both text inputs had no programmatically associated labels, and Escape left the form open. Mobile college-card icon buttons also lack accessible names when their text is hidden. Search Escape works, but its overlay also lacks dialog semantics. | Use accessible dialog behavior, associated form labels, focus management and persistent button names. Perform keyboard and screen-reader verification afterward. |
| Q06 | Medium, deployment hardening | **No CSP, framing policy or MIME-sniffing protection was observed.** The local production response lacked CSP, X-Frame-Options and X-Content-Type-Options; `next.config.ts` adds none. An external hosting proxy might supply them; it was not tested. | Configure appropriate production response headers and verify them on the deployed domain. |
| Q07 | Medium, configuration | **Deployment defaults are unsafe/incomplete.** Auth has a fixed fallback secret and Compose supplies one; `.dockerignore` excludes `.env*.local` but does not exclude `.env` from the build context. The current local AUTH_SECRET is configured, so the auth fallback was not active in this test. `NEXT_PUBLIC_APP_URL` is absent locally, so canonicals/sitemap use the fallback `admissionshub.in` domain despite Admission Here branding. | Fail closed for missing production secrets, exclude private environment files from image build context, and explicitly configure and verify the intended canonical domain. Final Docker image contents were not inspected. |
| Q08 | Low | **Linting is not configured.** `npm run lint` opens an interactive setup prompt. A successful build/type check does not replace linting. | Add a checked-in ESLint configuration and a noninteractive lint command for CI. |

## What worked

- Production build and TypeScript validation.
- Authenticated admin saves, publication timestamps, live updates, moderation, lead status/notes, approval state handling and related college data CRUD.
- Staff college scope, revoked permissions and disabled-account handling tested by the existing suites.
- Student profile saves, application ownership/privacy, review submission/editing/moderation and sign-out.
- Predictor validation and historical-cutoff filtering in the regression cases, including insufficient-data handling.
- Excel lead export contents, phone/text handling, complete authorized records and permission checks.
- Public college/profile tabs for the existing records loaded during the crawl.
- Corrected real-browser comparison navigation reached `/compare/iim-ahmedabad-vs-iit-bombay` and displayed a comparison heading.
- The 19 inspected admin/partner screens rendered without application error views. This establishes rendering, not completion of every feature on each screen.
- The 12 sampled mobile layouts fit the viewport. This is not a complete accessibility or device certification.

## Suggested repair order

1. Resolve S01/S02 before any public release. Configure secrets and triage dependency advisories next.
2. Fix invalid-input crashes, unpublished hierarchy exposure, missing destinations and partner submission/upload.
3. Correct counselor matching, college selection in blogs, line-break handling, mislabeled links and unsupported public metrics.
4. Finish accessibility, metadata/canonicals, social images, pagination, response headers and linting.
5. Repeat regression tests and browser checks on the deployed configuration after repairs.

## Limits

No production changes, external college admissions submission, email/SMS/OTP delivery, payment flow, load/penetration test, or official admissions-data fact check was performed. External brochure URLs were not all opened. No Lighthouse/Web Vitals score or screen-reader certification is claimed. npm findings describe installed dependency advisories, not demonstrated exploitability of every package. Stored HTML execution was proven only with isolated local author/content records and a harmless browser flag.

The application captures admission enquiries; a recorded lead is not evidence of a completed application at an external institution. Policy adequacy and jurisdiction-specific legal compliance were not evaluated.
