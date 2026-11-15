# Admin panel audit — 13 November 2026

**Update:** The findings below are the original audit. Their fixes and final verification are documented in [ADMIN_FIXES_2026-11-13.md](ADMIN_FIXES_2026-11-13.md).

Audit only: no application feature code was changed. Tested the local development app through real authenticated Super Admin and temporary Staff sessions, browser interactions, HTTP requests, and database verification. Temporary test data used a unique `qa-audit-` prefix.

Visited 14 admin screens: dashboard, college directory/create, approvals, enquiries, lead board, exams, blog list/create, reviews, SEO/GEO, users, staff list/create. Also exercised college and blog edit screens. A page loading successfully is recorded separately from its features working.

## Confirmed problems

| ID | Priority | Feature | Reproduction / observed result |
| --- | --- | --- | --- |
| A01 | High | Blog publishing access | A request without login to `POST /api/v1/cms/publish` published the QA draft (HTTP 200). |
| A02 | High | Review moderation access | A request without login to `POST /api/v1/cms/reviews/moderate` rejected the QA review (HTTP 200). |
| A03 | High | Disabled staff accounts | Disabled QA staff could establish a new login and keep using an existing session. |
| A04 | High | Permission revocation | Removing `blogs` permission did not remove blog API access from the current staff session. |
| A05 | High | Assigned-college restrictions | Staff assigned to one QA college could retrieve another unassigned college through the CMS API. |
| A06 | High | College unpublishing | Unpublishing saved correctly, but the anonymous direct profile URL still loaded the college. |
| A07 | High | Draft/unpublished blog privacy | A new draft and a previously published article changed back to draft both remained accessible anonymously by direct URL. |
| A08 | High | Lead board Save & Close | In `/admin/leads`, changed the QA lead to Final Admission and entered notes. After Save & Close, database still held CONTACTED and the previous notes. Browser state changes are not saved. The separate Enquiries Desk does save correctly. |
| A09 | Medium | New-college brochure download | Saved a valid `brochurePdfUrl` in admin, but the public brochure endpoint returned an empty document list because it only reads the curated static catalog. |
| A10 | Medium | College SEO overrides | Custom `metaTitle` and `metaDescription` save in the database, but profile metadata generation does not select/use them. Browser title used the generated default. |
| A11 | Medium | Enquiry search by college | Searching the linked QA college name returned no enquiry, despite the field advertising college search. Searching the student name worked. |
| A12 | Medium | Review aggregates | Approving one 5-star QA review made it public, but the college still had `reviewCount=0` and `ratingOverall=0`. |
| A13 | Medium | College CTA blog block | Clicked + College CTA then Live Preview. No embedded college card appeared. Renderer removes the shortcode but does not resolve its college slug. |
| A14 | Medium | Live-blog update authoring | The live-blog toggle saves, but no UI edits live update items; submitting `liveUpdatesJson` is ignored by the save schema, leaving it null. |
| A15 | Medium | Publish-toggle timestamp | Publishing a fresh draft via the blog-list PATCH action saved PUBLISHED while `publishedAt` remained null. |
| A16 | Medium | AUTHOR editorial access | Existing seeded AUTHOR account can log in, but `/api/v1/cms/blogs` returns 401. Current guards allow SUPER_ADMIN and appropriately permitted STAFF, not AUTHOR. |
| A17 | Medium | Closed approval requests | A rejected QA request could subsequently be approved by the approval API; no pending-state guard prevents reprocessing a closed request. |

## Advertised management features that are not implemented

| ID | Feature | What exists |
| --- | --- | --- |
| M01 | Exam creation/editing, dates, syllabus, counselling and cutoff management | Exam cards with View Hub / Test Predictor links. No editor or exam CRUD endpoint. |
| M02 | General user/role management | Read-only user/role table. No create, edit, role-change, or delete controls/API. Staff Management is separate and partly works. |
| M03 | College course mappings, fees, cutoffs, placements and agency rankings | College profile editor does not provide editors or CRUD endpoints for these related records, despite its labels advertising course/fee management. |

## Working workflows verified

- Super Admin login and all listed admin screens load.
- College creation and profile updates save; a real browser edit appears on the public overview.
- Updated admission text, FAQ answers and gallery URLs appear on their public tabs.
- Newly created college overview and all eight sub-tabs load.
- Blog draft creation, editor draft save, content edits and publish-through-editor save work.
- Enquiries Desk saves status/notes; student-name filtering and CSV export work.
- Review approval saves and makes the review public (aggregate updating and access protection fail as listed above).
- Staff account creation, persisted permission edits, own-article listing/deletion, and other-author edit/delete restrictions work.
- Staff college changes queue for approval; admin approval applies them; revision/rejection states save.
- Staff cannot delete college profiles or access Super Admin staff-management endpoints.
- College CMS rejects anonymous access.
- SEO feed links `/llms.txt`, `/llms-full.txt`, and `/sitemap.xml` return 200 with expected content types. This verifies delivery, not the panel's claims about external search indexing or automated schema verification.
- Test blog, staff and college deletion succeeded.

## Scope and cleanup

All generated QA colleges, blogs, staff accounts, reviews and enquiries were removed. Original application records were not edited. The existing user-created `test-college` was not part of the fixtures.

No production deployment, email delivery, external analytics/indexing, load test, or exhaustive browser/device coverage was performed. No feature fixes were made; this report is for choosing the next work.

## Individual check log

44 checks passed, 19 checks failed, 3 advertised management areas are missing. These are check counts, not independent feature counts; related failures are grouped above.

| Check | Result | Evidence |
| --- | --- | --- |
| Admin login | PASS | Real credentials session established. |
| College create/update/publication | PASS | New profile saved, edited, and updated overview visible publicly. |
| College SEO overrides | FAIL | Saved custom title; rendered title: qa-audit-1794573553962 College Admissions 2026: Cutoffs, Fees, Placements &amp; Ranking \| AdmissionsHub |
| Admin brochure URL on new college | FAIL | Saved a valid brochurePdfUrl but brochure endpoint returns 0 documents. |
| Unpublish hides college direct URL | FAIL | After unpublishing, anonymous profile request returned 200. |
| New college profile tabs | PASS | All 8 sub-tabs return HTTP 200. |
| Draft blog visibility | FAIL | Unpublished article request returned 200. |
| Blog create/edit/publish | PASS | Draft created; updated article published; new body appears publicly. |
| Unpublish blog visibility | FAIL | Draft after publication returned 200. |
| Blog publish timestamp | PASS | publishedAt persisted: true |
| Publishing requires admin login | FAIL | Anonymous publish request returned 200 and status PUBLISHED. |
| Enquiry capture/filter/update/export | PASS | Public enquiry saved; status and notes persisted; student search and CSV include test entry. |
| Enquiry search by college name | FAIL | Searching the linked college name returns 0 enquiries. |
| Review moderation | PASS | Fixture approved and visible on public reviews tab. |
| Review rating/count refresh | FAIL | Approved one 5-star review; college reviewCount=0, ratingOverall=0. |
| Review moderation requires admin login | FAIL | Anonymous rejection request returned 200. |
| Staff create/edit/login/approval workflow | PASS | Staff account created; update queued; admin approval applied database change. |
| Approval rejection/revision | PASS | Revision-request and rejection states persisted without changing live data. |
| Staff assigned-college restriction | FAIL | Staff assigned to one college can GET another college: HTTP 200. |
| Permission changes affect current sessions | FAIL | After removing blogs permission, old session blog API returned 200. |
| Disabled staff cannot sign in | FAIL | Disabled account new login accepted: true. |
| Disabled staff loses current access | FAIL | Disabled account current session college API returned 200. |
| Admin page /admin | PASS | {"heading":"Platform Governance & KPI Dashboard","denied":false,"error":false,"inputs":0} |
| Admin page /admin/colleges | PASS | {"heading":"Colleges Master Directory","denied":false,"error":false,"inputs":0} |
| Admin page /admin/colleges/new | PASS | {"heading":"Onboard New Institutional Profile","denied":false,"error":false,"inputs":21} |
| Admin page /admin/approvals | PASS | {"heading":"Staff Activity & Approval Dashboard","denied":false,"error":false,"inputs":0} |
| Admin page /admin/enquiries | PASS | {"heading":"Enquiry Management Dashboard","denied":false,"error":false,"inputs":10} |
| Admin page /admin/leads | PASS | {"heading":"B2B Student Lead CRM & Attribution Desk","denied":false,"error":false,"inputs":0} |
| Admin page /admin/exams | PASS | {"heading":"Entrance Exams & Cutoff Matrix Manager","denied":false,"error":false,"inputs":0} |
| Admin page /admin/blogs | PASS | {"heading":"Editorial Blog CMS Desk","denied":false,"error":false,"inputs":0} |
| Admin page /admin/blogs/new | PASS | {"heading":"Author New SEO & GEO Editorial Article","denied":false,"error":false,"inputs":9} |
| Admin page /admin/reviews | PASS | {"heading":"Student Review & ID Proof Moderation Queue","denied":false,"error":false,"inputs":0} |
| Admin page /admin/seo-geo | PASS | {"heading":"SEO & Generative Engine Optimization (GEO) Control Panel","denied":false,"error":false,"inputs":0} |
| Admin page /admin/users | PASS | {"heading":"User & RBAC Role Directory","denied":false,"error":false,"inputs":0} |
| Admin page /admin/staff | PASS | {"heading":"Staff & Role Access Control","denied":false,"error":false,"inputs":1} |
| Admin page /admin/staff/new | PASS | {"heading":"Create New Staff Member","denied":false,"error":false,"inputs":9} |
| College edit form browser save | PASS | Edited via real form and checked public overview. |
| Lead board Save & Close persistence | FAIL | After changing to Final Admission and saving notes, database still has CONTACTED / QA persistent counselor note. |
| Blog College CTA block preview | FAIL | Inserted College CTA shortcode, opened Live Preview; embedded college card present: false. |
| Blog browser draft save | PASS | Real editor Save as Draft returned to blog list. |
| SEO feed /llms.txt | PASS | {"status":200,"contentType":"text/plain; charset=utf-8","text":"# AdmissionsHub LLM Manifest & Machine-Readable Directory\n> AdmissionsHub is Ind"} |
| SEO feed /llms-full.txt | PASS | {"status":200,"contentType":"text/markdown; charset=utf-8","text":"# AdmissionsHub Full Knowledge Base for LLM Indexing (AEO / GEO)\n\n## College: In"} |
| SEO feed /sitemap.xml | PASS | {"status":200,"contentType":"application/xml","text":"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/sc"} |
| AUTHOR account editorial access | FAIL | Seeded editorial AUTHOR can log in but blog API returns 401. |
| Staff college deletion blocked | PASS | Staff DELETE returned 403. |
| Staff management restricted to super admin | PASS | Staff-management GET returned 403. |
| Closed approval requests cannot be approved again | FAIL | A previously rejected request was approved: HTTP 200. |
| Live blog update editing | FAIL | isLiveBlog saved, but submitted liveUpdatesJson is null; editor has no update entry controls. |
| Blog list publish toggle timestamp | FAIL | Draft -> PUBLISHED returned 200 with publishedAt=null. |
| Delete college with existing enquiry | PASS | Deleting QA college with linked test enquiry returned 200; database retains college: false. |
| College CMS requires login | PASS | Anonymous college API returned 401. |
| Exam create/edit/cutoff management | MISSING | Exam admin page contains only View Hub and Test Predictor links; no create/edit controls or exam CRUD routes. |
| User role editing | MISSING | Users directory displays accounts and roles but has no role-change, user-create, edit or delete controls/API. |
| Course/fees/cutoff/placement/ranking editing | MISSING | College editor has only profile/media/overview/FAQ/SEO fields; no forms or CRUD APIs for course mappings, fees, cutoffs, placements or agency rankings. |
| Edited college FAQs on Q&A tab | PASS | Saved FAQ answer visible in Q&A tab: true |
| Edited gallery image published | PASS | Saved gallery URL visible on public gallery: true |
| Edited admission text published | PASS | Saved admission content visible on admission tab: true |
| Staff sees only own articles | PASS | Own-post listing checked. |
| Staff cannot edit another author article | PASS | Other author PATCH returned 403. |
| Staff cannot delete another author article | PASS | Other author DELETE returned 403. |
| Staff own draft delete | PASS | Own draft DELETE returned 200. |
| QA blog delete efe17c1f-1ef0-422b-b91c-5de4ad053691 | PASS | Delete HTTP 200. |
| QA blog delete 65cac122-96f6-40ce-8a07-65b8471e0e05 | PASS | Delete HTTP 200. |
| QA staff delete | PASS | Delete HTTP 200. |
| QA college delete 03a0f075-846c-48c0-b51e-1e2a76b94187 | PASS | Delete HTTP 200. |
| QA cleanup | PASS | All generated college, blog, staff, enquiry and review records removed; original records untouched. |
