# AdmissionsHub: Higher Education Discovery, CMS & Dual AI Search Platform

AdmissionsHub is a production-ready, type-safe Higher Education Discovery Directory, Editorial Blog CMS, B2B Student Lead Generation CRM, and Dual AI Search Platform modeled after industry benchmarks (*Shiksha, Collegedunia, Careers360, CollegeDekho*).

Built with **Next.js 15 (App Router)**, **React 19**, **TypeScript**, and **PostgreSQL 18** (with native `tsvector` full-text search triggers, `pg_trgm` fuzzy matching, and vector compatibility).

---

## 🚀 Key Highlights & Architecture

### 1. Public Student Portal (SSR & ISR)
- **Homepage (`/`)**: AI Search Command Bar, Stream discovery grid, top NIRF-ranked institutions, live exam news.
- **Programmatic SEO Directory (`/colleges/[[...filters]]`)**: Faceted multi-dimensional filtering by Stream, Degree, State (e.g. `/colleges/b-tech/odisha`), Ownership, and Max Fees.
- **Persistent College Layout & Programme Tabs (`/college/[slug]`)**:
  - `Overview` (`/`): Quick facts, highlights, facilities, and accreditations.
  - `Courses & Fees` (`/courses-fees`): Comprehensive tuition, hostel costs, intake seats, and Course JSON-LD.
  - `Admission 2027` (`/admission`): Step-by-step JoSAA/institutional counseling workflow.
  - `Placements` (`/placements`): Highest CTC, Average CTC, Median package, placement rates, and top recruiters.
  - `Campus Gallery` (`/gallery`): High-res photos of labs, auditoriums, hostels, and sports arenas.
  - `Student Reviews` (`/reviews`): Verified ID-checked student ratings across Placements, Infrastructure, Faculty, and Value/ROI.
  - `Q&A` (`/qna`): Verified answers with Schema.org `FAQPage` JSON-LD.
- **Side-by-Side 4-Way Comparison (`/compare/[pair]`)**: e.g., `/compare/iit-bombay-vs-nit-rourkela` matrix benchmark.
- **Algorithmic Rank/Score Predictor (`/college-predictor/[exam]`)**: Categorized High, Medium, and Dream college admission chances based on user category, score, and state quota.
- **Editorial Blog & Live News (`/blog`, `/blog/[slug]`)**:
  - 4-bullet AI / GEO Answer Box (`<BlogTldrBox />`) for search engine direct citations.
  - Live Exam Coverage Ticker (`<LiveBlogTicker />`) with pinned updates and timestamps.
  - Embedded Interactive College Card (`<EmbeddedCollegeCTA slug="..." />`) for high-intent conversions.

### 2. Full Admin & Blog CMS Control Panel (`/admin`)
- **Dashboard (`/admin`)**: Analytics for captured student leads, traffic KPIs, and indexed colleges.
- **College Directory Manager (`/admin/colleges`)**: College data table, status manager, and new college onboarding (`/admin/colleges/new`).
- **Exam Master (`/admin/exams`)**: Application windows, exam dates, syllabus, and cutoff benchmarks.
- **Editorial CMS Desk (`/admin/blogs`)**:
  - Rich MDX/TipTap editor with shortcode buttons (`[+ College CTA]`, `[+ TL;DR]`, `[+ Live Feed]`).
  - Real-time SEO & GEO Scorer auditing title length, SERP description, answer box presence, and schema readiness.
- **Review Moderation Queue (`/admin/reviews`)**: Verify student identity card proofs and approve/reject reviews.
- **B2B Lead CRM Kanban (`/admin/leads`)**: Student pipeline (`NEW` → `OTP_VERIFIED` → `ASSIGNED_TO_COUNSELOR` → `CONTACTED` → `ENROLLED`) with blog attribution.
- **SEO & GEO Monitor (`/admin/seo-geo`)**: Verification of `/llms.txt`, `/llms-full.txt`, `sitemap.xml`, and JSON-LD graphs.
- **User & RBAC Access (`/admin/users`)**: Role-based access control (`SUPER_ADMIN`, `AUTHOR`, `COLLEGE_ADMIN`, `STUDENT`).

### 3. Dual AI & Search Engines
- **PostgreSQL tsvector + Vector RRF Hybrid Search**: Raw SQL Reciprocal Rank Fusion combining full-text keyword ranking with trigram similarity (`/api/v1/search/hybrid`).
- **AI Admissions Counselor (`/api/v1/ai/counselor`)**: Context-grounded RAG counselor providing targeted college advice.

### 4. Technical SEO & Generative Engine Optimization (GEO / AEO)
- Dynamic `/llms.txt` and `/llms-full.txt` feeds for AI crawlers (Perplexity, ChatGPT, Claude, Gemini).
- Schema.org JSON-LD structured data: `CollegeOrUniversity`, `Course`, `NewsArticle`, `FAQPage`, `BreadcrumbList`.
- Sharded XML sitemaps at `/sitemap.xml` covering colleges, tabs, blogs, and exams.

---

## 🛠️ Technology Stack
- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript (Strict)
- **Database**: PostgreSQL 18 with `pg_trgm`, `searchTsv` GIN indexes, and `vector` domain
- **ORM & Validation**: Prisma ORM 6.19 + Zod
- **Authentication**: Auth.js v5 (NextAuth) with 4-tier RBAC
- **Styling**: Tailwind CSS + Lucide Icons + Radix Primitives

---

## 🏃‍♂️ How to Run

1. **Start PostgreSQL**:
   Ensure PostgreSQL is running on port 5432 with database `admission_db`.

2. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Production Build & Start**:
   ```bash
   npm run build
   npm run start
   ```


Demo seeding is disabled. Create content and manage accounts through the admin dashboard.

### Generate blog drafts from a title

In the blog editor, enter a title and choose **Generate from title**. Preview the result, then choose **Use draft in editor** to insert the article, SEO fields, tags, category, and FAQs. This does not save or publish the article; selected college links and the featured image are retained.

Without an AI key, generation returns a clearly labelled starter draft with topic-specific guidance. To enable AI writing, set `OPENAI_API_KEY` on the server, optionally set `BLOG_DRAFT_MODEL` (default `gpt-4o-mini`), and restart the app. The key is never sent to the browser. Review generated content and verify institution-specific facts before publication.

### Public user accounts

Visitors can choose **Sign in → Create an account** to register with a name, email and password. Registration creates a student account and signs the visitor in; students can manage their own profile, applications and reviews under **My account**. Staff, author and administrator sign-ins keep their existing role-specific destinations. Student accounts cannot request staff/admin roles or permissions through registration.

Passwords are hashed before storage. Sign-in uses the stored password hash for every account; the retired administrator password shortcuts are no longer accepted. Sessions use Auth.js cookies, and the optional Save password checkbox delegates saving to the browser’s password manager. Passwords are never stored in application local storage. This flow does not send email verification or password-reset messages.

Registration and sign-in attempts are limited in PostgreSQL across app instances. Migration `017_user_login` creates `AuthThrottle`; development, npm production and Docker startup also prepare it for legacy databases. Configure the reverse proxy to overwrite forwarded client-address headers. Set a private `AUTH_SECRET` and the public `AUTH_URL`/`NEXTAUTH_URL` before production; Docker Compose requires the secret instead of supplying a shared default. Keep that secret consistent across all instances and releases.

### Staff designations

In **Staff Management**, enter a designation when creating a staff account or choose **Edit staff details** to update an existing member. Designations are optional and limited to 120 characters; clearing the field removes the title. The saved title appears with staff names in the admin header/sidebar, staff and user lists, approvals/activity, and blog author details. The designation is a display label; feature access continues to use the account’s role and permissions. Existing sessions pick up profile changes on refresh.

Migration `016_staff_designation` adds the nullable `User.designation` column. Apply it with the normal release migrations before deploying the generated Prisma Client. The existing npm/Docker startup preparation also adds this column for legacy databases that do not have a migration baseline.

### Blog SEO and reader tools

The blog editor includes search and social previews, metadata suggestions from the article title and body, and checks for headings, internal links, reference links, cover images and alt text. The first comma-separated tag is used as the main topic for coverage hints. Suggestions change fields only when selected; save the article to persist them. The score is an editorial guide, not a search-engine ranking score.

Published website and college articles include reading time, automatic contents links for two or more section headings, link copying, native sharing and WhatsApp sharing. Article metadata and structured data use the saved title, description, dates and images, with news and guide articles classified separately. Set `NEXT_PUBLIC_APP_URL` to the public website origin when building a production release so canonical and structured-data URLs use the correct domain.

### Blog view measurement

New article views qualify after 45 seconds of active reading in a visible, focused tab. Background time and time after 60 seconds without reader activity are excluded. A page visit counts once; a return visit can count again after qualifying separately. Signed, time-checked visit tickets and an atomic event record prevent immediate submissions and duplicate retries from inflating counts. Unique visitors continue to use the anonymous signed browser identity. Editorial accounts and common bots are excluded. Existing historical analytics are retained.

The tracker retries temporary network/database failures and resumes when the browser comes back online. Completed submissions reuse their ticket so retries cannot add duplicate views.

`npm start` and the Docker container prepare missing `BlogVisit` and `BlogQualifiedView` tables before serving requests, preserving existing view data. The startup check also prepares missing bulk-import storage (`CollegeImport` and `CollegeImportRow`) and adds the `AIDED` ownership enum value when missing. This supports older databases without a Prisma migration baseline; it does not run all historical migrations or create the base application schema. The database account needs permission to create missing tables. An account that owns the enum must apply migration `018_aided_college_ownership` ahead of startup if the application account cannot alter the enum. Migration-managed deployments should apply their pending migrations with `prisma migrate deploy` before starting the app. For hosts that launch standalone `server.js` directly, run `node scripts/prepare-blog-analytics.cjs` first (include that script and the `prisma/migrations` directory in the release). You can also run `npm run db:prepare-blog-analytics` as a release step. Keep the same `AUTH_SECRET` on every app instance so view tickets remain valid across requests.

### Programme-specific college profiles

Maintain one college with multiple course offerings under **Courses and fees**. Filtered programme results open `/college/<slug>/programs/<degree>`; its tabs retain that programme context. Each offering supports its own overview, admission and placement notes, alongside fees, eligibility and exam cutoffs. General campus information is shared. Missing programme data is shown as unavailable rather than replaced with another programme’s figures. New degree profiles are also added to the sitemap.
