# Admin audit fixes — 13 November 2026

All 17 grouped defects and three missing management areas in the original audit have been addressed.

| Audit item | Change |
| --- | --- |
| A01–A02 Publishing and moderation access | Both endpoints require a current authorized session; article publishing also checks ownership. |
| A03 Disabled staff | Disabled users cannot sign in, and existing sessions lose access immediately. |
| A04 Revoked permissions | Session access reads current roles and permissions from the database on every request. |
| A05 College assignments | College pages/APIs and college-specific enquiry/review lists enforce assigned college IDs. Staff Management now includes an assignment editor. |
| A06 College unpublishing | Unpublished profiles and tabs return not-found content; comparison, exam results and predictor queries exclude unpublished colleges. |
| A07 Blog privacy | Draft and archived articles cannot be read publicly by URL. |
| A08 Lead board | Save & Close persists status and notes through the enquiry API, with saving/error feedback. |
| A09 New-college brochures | The download form resolves the admin-saved brochure URL as well as the curated catalog. College cards and embedded blog cards use the same working brochure form. |
| A10 College SEO | Custom title and description are used for profile metadata. |
| A11 Enquiry search | College-name matching is included alongside student/contact/course search. |
| A12 Review aggregates | Approvals and rejections atomically recalculate approved review counts and average ratings. Existing college totals were rebuilt from approved reviews. |
| A13 College CTA blocks | The renderer resolves shortcode college slugs and renders real cards in preview and published articles. |
| A14 Live updates | The editor provides headline, timestamp, text, pin and removal controls; updates persist through the API and render publicly. |
| A15 Publish dates | Publishing a draft through the list action sets its publication timestamp. |
| A16 AUTHOR access | AUTHOR accounts have editorial access with ownership restrictions. |
| A17 Approval processing | Pending requests are claimed and applied atomically. Rejected, approved and revision-requested entries cannot be processed again; corrected changes use a new submission. |
| M01 Exam manager | Create, edit and delete exams, application/exam/result dates, overview, syllabus, pattern and counseling instructions. |
| M02 User/role manager | Create, edit, enable/disable, change roles and delete non-staff accounts. Password hashes are never returned. Self-demotion/deletion and removing the last active Super Admin are blocked. Staff accounts stay in Staff Management. |
| M03 College data editors | Course catalog, college course/fee mappings, intake, eligibility, cutoffs, placements and rankings now have create/edit/delete forms and endpoints. Staff proposals require approval. |

Additional verification found a production login configuration issue: Auth.js did not trust the configured legacy NEXTAUTH_URL in production. This was fixed using the configured canonical URL. Partner dashboards and profile pages also check account ownership.

## Where to find the editors

- **Colleges Directory → Edit → Manage courses, fees, cutoffs, placements & rankings** opens the college data editor.
- **Course Catalog** in the sidebar manages shared course definitions. Super Admins edit the catalog; staff can reference it when proposing college data changes.
- **Entrance Exams** includes an exam editor below the exam cards.
- **User & Role Access** includes the account editor below the directory. Staff permissions and college assignments are managed separately in **Staff Management**.
- **Staff Management → Assigned colleges** controls which colleges staff can access. An empty assignment list grants no college-specific access.
- **Blog editor → Live updates** appears when the live-blog option is enabled.

## Verification

- Production build completed successfully, including type checks and page generation.
- Final production integration run: **26 passed, 0 failed**.
- Browser checks covered creation in all seven resource editors, lead-board persistence, College CTA preview, live-update saving, staff assignment controls and a 390-pixel mobile editor layout.
- Public content checks confirmed saved college overview/metadata, FAQs, admission text, gallery, course fees, cutoffs, placements, rankings, exam details and live-blog updates.
- QA accounts, colleges, articles, enquiries, reviews, exams and courses were removed after testing. Original user-created records were retained. Existing aggregate review counts/ratings were intentionally recalculated from approved reviews.

Repeat the integration checks with the app running:

```sh
node scripts/verify-admin-workflows.cjs
```

The script uses the local seeded Super Admin by default. For another installation, provide `QA_BASE_URL`, `QA_ADMIN_EMAIL` and `QA_ADMIN_PASSWORD` through the environment. It creates isolated `qa-fix-*` fixtures and removes them automatically. No production deployment was performed.
