import { NAVBAR_COLUMN_TITLES, type NavbarCategory } from "./navbar-categories";

export interface SubItem {
  label: string;
  href: string;
  badge?: string;
}

export interface StreamColumn {
  title: string;
  items: SubItem[];
}

export interface NavCategory {
  key: NavbarCategory;
  label: string;
  mainHref: string;
  columns: StreamColumn[];
}

export const CATEGORIES: NavCategory[] = [
  {
    key: "mba",
    label: "MBA",
    mainHref: "/colleges/mba",
    columns: [
      {
        title: NAVBAR_COLUMN_TITLES.mba[0],
        items: [
          { label: "Top MBA Colleges in India", href: "/colleges/mba" },
          { label: "Top IIMs in India", href: "/colleges?q=IIM" },
          { label: "Top MBA in Delhi NCR", href: "/colleges/mba?state=Delhi" },
          { label: "Top MBA in Mumbai", href: "/colleges/mba?state=Maharashtra" },
          { label: "Top MBA in Bengaluru", href: "/colleges/mba?state=Karnataka" },
        ],
      },
      {
        title: NAVBAR_COLUMN_TITLES.mba[1],
        items: [
          { label: "CAT 2027 Exam", href: "/exams/cat" },
          { label: "XAT 2027 Exam", href: "/exams/cat" },
          { label: "MAT Exam Details", href: "/exams/cat" },
          { label: "CAT College Predictor", href: "/college-predictor/cat" },
          { label: "IIM Cutoff Analysis", href: "/blog/top-10-mba-colleges-in-india-cat-cutoffs-placements" },
        ],
      },
      {
        title: NAVBAR_COLUMN_TITLES.mba[2],
        items: [
          { label: "MBA in Finance", href: "/colleges/mba" },
          { label: "MBA in Marketing", href: "/colleges/mba" },
          { label: "MBA in Human Resources", href: "/colleges/mba" },
          { label: "MBA in Business Analytics", href: "/colleges/mba" },
          { label: "Executive MBA Programs", href: "/colleges/mba" },
        ],
      },
    ],
  },
  {
    key: "engineering",
    label: "ENGINEERING",
    mainHref: "/colleges/b-tech",
    columns: [
      {
        title: NAVBAR_COLUMN_TITLES.engineering[0],
        items: [
          { label: "Top B.Tech Colleges in India", href: "/colleges/b-tech" },
          { label: "Top IITs in India", href: "/colleges?q=IIT" },
          { label: "Top NITs in India", href: "/colleges?q=NIT" },
          { label: "Top IIITs in India", href: "/colleges?q=IIIT" },
          { label: "Top Colleges in Odisha", href: "/colleges/b-tech/odisha" },
        ],
      },
      {
        title: NAVBAR_COLUMN_TITLES.engineering[1],
        items: [
          { label: "JEE Main 2027", href: "/exams/jee-main", badge: "Live" },
          { label: "GATE 2027", href: "/exams/gate" },
          { label: "OJEE Engineering", href: "/exams/ojee" },
          { label: "JoSAA Cutoffs Predictor", href: "/college-predictor/jee-main" },
          { label: "NIT Opening & Closing Ranks", href: "/blog/jee-main-2027-cutoff-analysis-for-top-nits" },
        ],
      },
      {
        title: NAVBAR_COLUMN_TITLES.engineering[2],
        items: [
          { label: "Computer Science (CSE)", href: "/colleges/b-tech" },
          { label: "Artificial Intelligence & ML", href: "/colleges/b-tech" },
          { label: "Electronics & Communication", href: "/colleges/b-tech" },
          { label: "Mechanical Engineering", href: "/colleges/b-tech" },
          { label: "Civil Engineering", href: "/colleges/b-tech" },
        ],
      },
    ],
  },
  {
    key: "medical",
    label: "MEDICAL",
    mainHref: "/colleges/mbbs",
    columns: [
      {
        title: NAVBAR_COLUMN_TITLES.medical[0],
        items: [
          { label: "Top MBBS Colleges in India", href: "/colleges/mbbs" },
          { label: "AIIMS Institutes Across India", href: "/colleges?q=AIIMS" },
          { label: "Top Govt Medical Colleges", href: "/colleges/mbbs?ownership=PUBLIC_GOVERNMENT" },
          { label: "Top BDS (Dental) Colleges", href: "/colleges/mbbs" },
          { label: "Medical Colleges in Delhi", href: "/colleges/mbbs?state=Delhi" },
        ],
      },
      {
        title: NAVBAR_COLUMN_TITLES.medical[1],
        items: [
          { label: "NEET UG 2027 Exam", href: "/exams/neet-ug", badge: "Key" },
          { label: "NEET UG Counseling & Seat Matrix", href: "/blog/neet-ug-2027-counseling-dates-seat-matrix-breakdown" },
          { label: "NEET College Predictor", href: "/college-predictor/neet-ug" },
          { label: "MCC 15% AIQ Cutoffs", href: "/colleges/mbbs" },
        ],
      },
      {
        title: NAVBAR_COLUMN_TITLES.medical[2],
        items: [
          { label: "MBBS (Medicine)", href: "/colleges/mbbs" },
          { label: "BDS (Dental)", href: "/colleges/mbbs" },
          { label: "B.Pharm (Pharmacy)", href: "/colleges" },
          { label: "B.Sc Nursing", href: "/colleges" },
        ],
      },
    ],
  },
  {
    key: "design",
    label: "DESIGN",
    mainHref: "/colleges",
    columns: [
      {
        title: NAVBAR_COLUMN_TITLES.design[0],
        items: [
          { label: "National Institute of Design (NID)", href: "/colleges?q=NID" },
          { label: "National Institute of Fashion Tech (NIFT)", href: "/colleges?q=NIFT" },
          { label: "Top Architecture Colleges (B.Arch)", href: "/colleges?q=Architecture" },
          { label: "Top Private Design Colleges", href: "/colleges" },
        ],
      },
      {
        title: NAVBAR_COLUMN_TITLES.design[1],
        items: [
          { label: "UCEED Exam 2027", href: "/exams/jee-main" },
          { label: "NID DAT Exam", href: "/exams/jee-main" },
          { label: "NATA Architecture Exam", href: "/exams/jee-main" },
        ],
      },
      {
        title: NAVBAR_COLUMN_TITLES.design[2],
        items: [
          { label: "B.Des (Fashion Design)", href: "/colleges" },
          { label: "B.Des (UI/UX & Interaction)", href: "/colleges" },
          { label: "B.Arch (Architecture)", href: "/colleges" },
          { label: "Animation & Game Design", href: "/colleges" },
        ],
      },
    ],
  },
  {
    key: "more",
    label: "MORE",
    mainHref: "/colleges",
    columns: [
      {
        title: NAVBAR_COLUMN_TITLES.more[0],
        items: [
          { label: "Law Colleges (BA LLB / CLAT)", href: "/colleges?q=Law" },
          { label: "Top BCA / MCA Colleges", href: "/colleges?q=BCA" },
          { label: "Commerce & B.Com Colleges", href: "/colleges?q=Commerce" },
          { label: "Science & B.Sc Colleges", href: "/colleges?q=Science" },
        ],
      },
      {
        title: NAVBAR_COLUMN_TITLES.more[1],
        items: [
          { label: "Colleges in Odisha", href: "/colleges/b-tech/odisha" },
          { label: "Colleges in Maharashtra", href: "/colleges/b-tech/maharashtra" },
          { label: "Colleges in Delhi NCR", href: "/colleges?state=Delhi" },
          { label: "Colleges in Karnataka", href: "/colleges?state=Karnataka" },
        ],
      },
      {
        title: NAVBAR_COLUMN_TITLES.more[2],
        items: [
          { label: "College Compare Tool", href: "/compare/iit-bombay-vs-nit-rourkela" },
          { label: "JEE Main Predictor", href: "/college-predictor/jee-main" },
          { label: "Editorial & Live News", href: "/blog" },
        ],
      },
    ],
  },
  {
    key: "study_abroad",
    label: "STUDY ABROAD",
    mainHref: "/colleges",
    columns: [
      {
        title: NAVBAR_COLUMN_TITLES.study_abroad[0],
        items: [
          { label: "Study in USA (Universities & Visas)", href: "/colleges" },
          { label: "Study in UK (Russell Group)", href: "/colleges" },
          { label: "Study in Canada (PGWP & Colleges)", href: "/colleges" },
          { label: "Study in Germany (Tuition-Free)", href: "/colleges" },
          { label: "Study in Australia", href: "/colleges" },
        ],
      },
      {
        title: NAVBAR_COLUMN_TITLES.study_abroad[1],
        items: [
          { label: "IELTS Exam Preparation", href: "/exams/jee-main" },
          { label: "TOEFL Exam Updates", href: "/exams/jee-main" },
          { label: "GRE Test Guidelines", href: "/exams/gate" },
          { label: "GMAT for Global MBA", href: "/exams/cat" },
        ],
      },
      {
        title: NAVBAR_COLUMN_TITLES.study_abroad[2],
        items: [
          { label: "International Scholarship Grants", href: "/blog" },
          { label: "SOP & LOR Writing Guidance", href: "/blog" },
          { label: "Student Visa Counseling", href: "/login" },
        ],
      },
    ],
  },
  {
    key: "counseling",
    label: "COUNSELING",
    mainHref: "/colleges",
    columns: [
      {
        title: NAVBAR_COLUMN_TITLES.counseling[0],
        items: [
          { label: "JoSAA Counseling 2027 Process", href: "/exams/jee-main" },
          { label: "CSAB Special Rounds", href: "/college-predictor/jee-main" },
          { label: "MCC NEET Medical Allotment", href: "/blog/neet-ug-2027-counseling-dates-seat-matrix-breakdown" },
          { label: "State Quota Seat Matrix", href: "/colleges/b-tech/odisha" },
        ],
      },
      {
        title: NAVBAR_COLUMN_TITLES.counseling[1],
        items: [
          { label: "JEE Main College Predictor", href: "/college-predictor/jee-main", badge: "Hot" },
          { label: "NEET Medical Rank Matcher", href: "/college-predictor/neet-ug" },
          { label: "CAT Percentile Calculator", href: "/college-predictor/cat" },
        ],
      },
      {
        title: NAVBAR_COLUMN_TITLES.counseling[2],
        items: [
          { label: "Book 1-on-1 Counselor Call", href: "/login" },
          { label: "College Fee Waiver Check", href: "/colleges" },
          { label: "Verified Reviews & Ratings", href: "/colleges" },
        ],
      },
    ],
  },
];
