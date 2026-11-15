# Button audit — 14 November 2026

Result: not all controls work correctly. Audit only; no feature code changed.

## Confirmed issues

| Control | Finding | Source |
| --- | --- | --- |
| Partner: Submit Updates for Verification | `type="button"` with no click handler, form, or server action. Clicking cannot submit the edited fees. | `src/app/(partner)/partner/[collegeId]/profile/page.tsx:110` |
| Partner: brochure upload area | Advertises drag/drop and click to browse, but has no file input, drop handler, click handler, or upload action. | `src/app/(partner)/partner/[collegeId]/profile/page.tsx:85` |
| Blog editor: + College CTA | Always inserts `nit-rourkela`, regardless of article topic. The default new article also embeds this college. The control executes, but cannot select the appropriate college. | `src/components/admin/BlogMdxEditor.tsx:264` |

## Verification performed now

- Reviewed all 129 native button declarations under `src`, including submit buttons and their forms. Checked action bindings and inspected public search/filter/compare/modal and administrative handlers. Source review alone does not establish browser behavior.
- TypeScript: `npx tsc --noEmit --incremental false` passed.
- Local app: `http://localhost:3001`.
- `scripts/verify-admin-workflows.cjs`: 26 passed, 0 failed. Covers publishing, live updates, moderation, lead updates, approvals, permissions, user/exam/course/fee/cutoff/placement/ranking changes and deletion.
- `scripts/verify-portals.cjs`: 18 passed, 0 failed. Covers login requirements, profile persistence, application submission, review submission/moderation, student/staff scope, predictor responses, counselor query handling and sign-out.
- `scripts/verify-lead-export.cjs`: 7 passed, 0 failed. Covers dashboard links, complete lead listings, Excel contents and export authorization.
- The scripts removed their isolated temporary records afterward.

## Limits

The 51 passing checks are HTTP/database integration checks, not 51 browser button clicks. No browser automation dependency was available in the project. Mobile menu behavior, focus/keyboard behavior, modal interactions, download triggering in a browser, and every rendered button variant were not exercised in a real browser. External brochure destinations were not individually checked. Therefore this audit does not certify that every button works end to end.
