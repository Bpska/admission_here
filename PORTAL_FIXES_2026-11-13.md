# Staff and student portal verification — 13 November 2026

Implemented and verified the following local flows. This is a record of tested coverage, not a guarantee about every possible input or external service.

## Student changes

- Login routes by the authenticated role rather than an email-address substring. Student accounts cannot enter the staff portal through a login callback.
- Added `/student`, available through **My account**, with application/brochure request history, status, editable admissions profile, and personal review history.
- Applications made while signed in are linked to that student. Another account cannot see them; counselor notes are omitted from the student response. Anonymous requests remain supported and are not claimed by matching phone/email.
- Profile saves validate mobile number, state, exam, rank/percentile and category. Student edits cannot change account role or another user's record.
- Added student review submission/editing on college Reviews pages. Submissions and edits await moderation. Approval changes the public review and aggregate rating; editing removes the old approved rating until reviewed again.
- Connected college-card Compare buttons to a shared selection (up to four), persistent between pages, with remove/clear/compare actions. Comparison bar accommodates mobile navigation.
- Predictor now displays request failures, clears stale results when submitting, exposes home-state selection, validates AIR versus CAT percentile, excludes missing cutoffs, applies home/other-state eligibility and uses the latest recorded round/year per course/quota/category/gender.
- Counselor retrieval now uses query terms, course/budget filters and exam/category context. Removed unsupported blanket quota/admission advice; responses distinguish database matches from admission predictions.
- Missing placement data on college cards now says “Not available”.

## Staff changes

- Dashboard navigation is present for staff even when not explicitly listed in module permissions.
- Added actual sign-out, retaining the public-site exit link.
- Removed invalid quick links generated from permission subkeys such as `blogs:publish`.
- Both blog creation pages check module access on the server and pass publish capability to the editor, matching the existing API rules.
- Verified assigned-college limits, permission revocation, disabled accounts, lead updates, moderation, related-data editing and approval application with isolated records.
- Public Admin buttons continue to open the login form first.

## Validation

- `npx tsc --noEmit` — passed.
- `node scripts/verify-portals.cjs` — 18 passed, 0 failed.
- `node scripts/verify-admin-workflows.cjs` — 26 passed, 0 failed.
- Headless Chrome — 9 passed: real student login/role redirect, profile save/reload, applications status, reviews tab, review submission, comparison navigation, comparison persistence/clear/mobile width, student sign-out, staff sign-out.
- `npm run build` — passed (production compilation, type checks and page generation).
- All isolated database fixtures were removed after verification.

## Practical limits

Historical cutoff availability still depends on records maintained in the CMS. No external email/SMS provider or live admissions submission to a college was configured or tested. The application captures admission enquiries for staff follow-up. Existing anonymous enquiries are not automatically attached to a student account.
