# Bulk college Excel imports

## Start an import

1. Sign in as a **Super Administrator** and open **Colleges → Download Excel Template**.
2. Keep exactly one worksheet. Use one row per institution. The first row contains headings; do not merge cells or use formulas.
3. Delete the marked sample row, or replace its example values and clear **Sample Row**. A row marked SAMPLE is always skipped.
4. For a new college, enter College Name, City and State. Set College Type deliberately (the existing form default is PUBLIC_GOVERNMENT if omitted). Leave optional values blank. Publication defaults to Draft.
5. Add multiple degrees in **Programmes JSON**. College IDs and course IDs are not needed.
6. Open **Colleges → Bulk Upload Colleges**, choose `.xlsx` or UTF-8 comma-separated `.csv`, then **Upload and preview**.
7. Review the column mapping. Select a field for unrecognized headings or leave them ignored. Two columns cannot map to the same field.
8. Expand each college to inspect mapped data. Correct uploaded cells, choose Skip / Update / Create, and confirm any existing-college selection or intentional new duplicate candidate.
9. To update existing records, enable **Allow updates**. Blank cells do not erase saved information. Optional college fields can be cleared only by checking them explicitly in the row's clear-fields panel.
10. Click **Validate changes** after editing mappings, cells, permissions or decisions. Resolve errors, or explicitly skip invalid rows. A job with validation errors cannot start.
11. Check **I reviewed this preview**, then **Confirm and import**. A maximum of five colleges is processed per request. Each college and all its linked changes commit in one database transaction.
12. Download the results CSV. Use **Import History → Inspect / resume** for interrupted jobs. Correct failed rows, revalidate, and confirm again. Already completed rows remain immutable and are never replayed in the same job.

Limits: 10 MB compressed file/request file size, 40 MB expanded XLSX parts, 500 college rows, 80 columns, 100,000 characters per cell, 100 entries per JSON list. Uploads do not publish by default. Explicit Published cells require the publication permission checkbox. Existing publication status is preserved when blank.

## Programme JSON example

```json
[
  {
    "ref": "BTECH-CSE",
    "courseName": "Bachelor of Technology",
    "degree": "B.Tech",
    "stream": "Engineering",
    "level": "UG",
    "specialization": "Computer Science and Engineering",
    "durationYrs": 4,
    "totalFeesInr": 400000
  },
  {
    "ref": "MBA",
    "courseName": "Master of Business Administration",
    "degree": "MBA",
    "stream": "Management",
    "level": "PG",
    "specialization": "General",
    "durationYrs": 2
  },
  {
    "ref": "MCA",
    "courseName": "Master of Computer Applications",
    "degree": "MCA",
    "stream": "Computer Applications",
    "level": "PG",
    "specialization": "General",
    "durationYrs": 2,
    "programAdmissionHtml": "Graduates meeting the official eligibility may apply."
  }
]
```

Only enter verified fees. Numbers are plain INR, without commas, currency symbols or "LPA". Do not enter zero for unknown fees.

Additional programme fields match the existing Add College form: `publishedFeeInr`, `publishedCreditFeeInr`, `feeBasis`, `feeAcademicYear`, `feeSourceUrl`, `firstYearFeesInr`, `hostelFeesYearlyInr`, `intakeSeats`, `acceptedExamSlugs`, `minimumClass12Percent`, `eligibilityDescription`, `syllabusPdfUrl`, `programOverviewHtml`, `programAdmissionHtml`, `programPlacementHtml`. See header comments in the template.

Degree and specialization identify a college programme. A `ref` identifies it elsewhere in the same row; it is not a database ID. If a degree has several specializations, supply a unique ref for each. For an existing programme not supplied in Programmes JSON, use `Degree: Specialization` in linked records. Known B.Tech/MBA/MCA and related degrees must use their correct streams, so filters and detail links retain the selected programme context.

### Cutoffs JSON

```json
[
  {
    "programme": "BTECH-CSE",
    "entranceExam": "jee-main",
    "academicYear": 2026,
    "counselingRound": 1,
    "category": "GEN",
    "quota": "AI",
    "gender": "Gender-Neutral",
    "openingRank": 1000,
    "closingRank": 5000
  }
]
```

The entrance exam must already exist by name or slug. Quotas: AI/HS/OS; categories: GEN/OBC/SC/ST/EWS; genders: Gender-Neutral/Female-only. No internal IDs are accepted. A repeated programme/exam/year/round/category/quota/gender combination updates its existing cutoff.

### Placements JSON

```json
[
  {
    "batchYear": 2026,
    "highestPackageInr": 1200000,
    "sourceUrl": "https://example.edu/placement-report",
    "topRecruiters": ["Example Employer"]
  },
  {
    "programme": "MCA",
    "batchYear": 2026,
    "highestPackageInr": 900000,
    "sourceNote": "MCA graduating batch only"
  }
]
```

Without `programme`, the existing college-wide placement table is used (one row per year). With `programme`, figures are stored as year-marked sections in that programme's existing placement content. They never populate the institution-wide placement table or other degree pages. Reimporting the same programme/year replaces that imported section; other programme text and other imported years are retained. Photo URLs are accepted as references; no external image is fetched. Normal direct uploads still enforce the existing 3 MB limit.

### Rankings JSON

```json
[
  {
    "agencyName": "NIRF",
    "category": "Engineering",
    "rankingYear": 2025,
    "rankNumber": 100
  }
]
```

Agency, category and year identify an existing ranking. Use verified figures only.

### FAQs and Q&A JSON

```json
[
  {
    "question": "Which degrees are available?",
    "answer": "See the current programme list."
  }
]
```

### Content and images

Normal prose and sanitized HTML are supported. Highlights are appended to the college overview. Admission Eligibility, Important Dates and Admission Link become labelled sections in existing admission content; Facilities and individual facility descriptions populate the existing facilities list. University aliases Affiliation, so two conflicting values are rejected. Image URLs are references, not remote downloads. No workbook code is executed.

College blog title/content create a college-linked Draft article by default. Normalized matching titles update that college's existing article under the update confirmation. The existing article publication state is preserved unless an explicit publish action is requested. Website-listing defaults to No for a new article; omitted listing and category cells preserve an existing article's settings. College Blog Publish = Yes requires publication permission and a published college.

## Duplicate and retry rules

Normalized name/location, website host, slug and uncertain similar names are checked. Existing candidates default to Skip; Update requires a selected matching college and explicit confirmation. Create New with a possible match also requires explicit confirmation. Duplicate college rows in the same file must be combined or skipped. Duplicate programme/linked entries within a JSON array are rejected; existing matching database entries are updated instead of inserted again.

Importer writes are serialized with PostgreSQL advisory locks and serializable transactions. A durable per-row ledger records CREATED, UPDATED, SKIPPED or FAILED. Network retries cannot replay a completed row. Concurrent manual edits should be avoided during an import: the importer cannot lock arbitrary external writers. Each row is revalidated against current data immediately before mutation.

Import previews and history persist in PostgreSQL. They may contain institutional contact data; only Super Administrators can read or change them. Establish a retention and database-backup policy appropriate for your deployment. This feature does not set up a background worker: leaving the page stops further batches, which can be resumed from history.

## Deployment and local verification

New migration: `prisma/migrations/015_college_imports/migration.sql`. It adds only CollegeImport and CollegeImportRow; no existing college schema is changed.

On an already migration-managed deployment, review/apply pending migrations with your normal release procedure (`prisma migrate deploy`) before enabling the page, then regenerate Prisma Client/build. Do not blindly run all historical SQL on an existing database with no migration baseline. The local development database had that condition, so only migration 015 SQL was applied locally. Establish or verify a proper baseline separately before a production rollout. No production database was modified for implementation.

Run fixture tests against a disposable/local database:

```sh
node --env-file=.env --import tsx scripts/verify-college-import.ts
```

The script creates uniquely named temporary test institutions and import jobs, then deletes its fixtures in `finally`. Do not point it at production. Browser/API verification also uses temporary local fixtures. Apply the migration first. No deployment or automatic commit/push is part of this feature work.

## Implementation files

Modified:

- `prisma/schema.prisma`: durable import job and row ledgers.
- `src/app/(admin)/admin/colleges/page.tsx`: entry points alongside existing college controls.

Created:

- `prisma/migrations/015_college_imports/migration.sql`.
- `src/lib/college-import/fields.ts`: headings, aliases, limits and sample programmes.
- `src/lib/college-import/spreadsheet.ts`: bounded XLSX/CSV parsing, template and safe CSV exports.
- `src/lib/college-import/xlsx-values.ts`: direct OOXML worksheet-value reader.
- `src/lib/college-import/validate.ts`: mapping, field validation, duplicate candidates and programme references.
- `src/lib/college-import/service.ts`: preview, revisions, transactions, upserts, progress and retries.
- `src/lib/college-import/http.ts`: admin-only authorization, bounded requests and error responses.
- `src/app/api/v1/admin/college-imports/route.ts`: upload and paginated history.
- `src/app/api/v1/admin/college-imports/[id]/route.ts`: inspect, validate edits and confirmed batches.
- `src/app/api/v1/admin/college-imports/[id]/report/route.ts`: downloadable result/error CSV.
- `src/app/api/v1/admin/college-imports/template/route.ts`: actual formatted XLSX template.
- `src/app/(admin)/admin/colleges/bulk-upload/page.tsx`.
- `src/app/(admin)/admin/colleges/import-history/page.tsx`.
- `src/components/admin/CollegeBulkUpload.tsx` and `CollegeImportHistory.tsx`.
- `scripts/verify-college-import.ts`: local fixture regression suite.
- `exports/Admission_Here_College_Import_Template.xlsx`: generated downloadable single-sheet template.
- This guide.

## Verification results (20 November 2026)

- 23 local service/parser/data checks passed, including one/100 records, missing optional fields, duplicates, partial updates, linked records, malformed JSON, unknown columns, transaction rollback/retry, publication permission, explicit clearing, stale previews, row limits and unsafe HTML.
- The authenticated browser flow passed: downloaded template reupload, no writes before confirmation, manual mapping, correction of malformed JSON, import confirmation, retry-safe repeated requests, result downloads, history and programme-specific public URLs/fees.
- Anonymous and authenticated non-administrator users were denied import API access.
- The preview was checked at widths 375, 768 and 1440 pixels with no page/main overflow or browser runtime errors.
- Production build, TypeScript checks and whitespace checks passed.

All write tests used uniquely named local fixtures which were removed afterward. No production deployment or production data modification was performed. Evidence is saved under `audit/2026-11-20/college-import/`.

## XLSX compatibility

The importer reads worksheet values directly from OOXML ZIP/XML parts. It resolves workbook relationships and namespace URIs rather than relying on ExcelJS's workbook loader or fixed internal sheet filenames. It supports inline/shared strings, namespace aliases and UTF-8/UTF-16 XML. Formulas, error cells, merged cells, date serials, unsafe references and DTDs remain rejected. Eight database-free regression checks are available through `node --import tsx scripts/verify-college-xlsx.ts`, including 100-college XLSX input and custom worksheet paths. ExcelJS is retained for generating the styled downloadable template only.

The live local endpoint accepted a filled Excel template and confirmed one Draft college with B.Tech, MBA and MCA. Temporary records were removed.

## Completion and skipped colleges

After completion, the results screen shows created/updated/skipped totals and links to the saved college editors. Draft records need publication in the normal college editor before appearing on the public website. The completed job no longer displays inactive confirmation buttons. Upload another file resets the form.

To apply spreadsheet details to colleges that were skipped, select **Prepare updates for skipped colleges**. This creates a separate preview from those rows without modifying the completed history or any college. In that preview, **Update clear matches** selects only rows with one strong existing match and enables update permission. Uncertain matches still need individual review. Validate, review and explicitly confirm before any update is written. Empty cells continue to preserve saved values. A warning identifies updates that would set an existing published college to Draft.

New endpoint: `POST /api/v1/admin/college-imports/[id]/updates`. It is Super Administrator-only and prepares preview records only. Seven browser checks cover completion links, preparing skipped rows, no writes before confirmation, a successful update without duplicates, immutable original history, responsive layouts, form reset and authorization. Test evidence: `audit/2026-11-20/college-import/completion-workflow-results.json`.
