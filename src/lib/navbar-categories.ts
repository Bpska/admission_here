export const NAVBAR_CATEGORIES = [
  { value: "mba", label: "MBA" },
  { value: "engineering", label: "Engineering" },
  { value: "medical", label: "Medical" },
  { value: "design", label: "Design" },
  { value: "more", label: "More" },
  { value: "study_abroad", label: "Study Abroad" },
  { value: "counseling", label: "Counseling" },
] as const;

export const NAVBAR_CATEGORY_VALUES = ["mba", "engineering", "medical", "design", "more", "study_abroad", "counseling"] as const;

export const NAVBAR_SECTION_VALUES = ["featured", "column_1", "column_2", "column_3"] as const;
export type NavbarCategory = typeof NAVBAR_CATEGORY_VALUES[number];
export const NAVBAR_COLUMN_TITLES: Record<NavbarCategory, readonly [string, string, string]> = {
  mba: ["Top MBA Colleges", "MBA Exams & Cutoffs", "Popular Specializations"],
  engineering: ["Top Engineering Colleges", "Engineering Exams", "Top Branches"],
  medical: ["Top Medical Colleges", "Medical Exams & Alerts", "Healthcare Degrees"],
  design: ["Top Design Institutes", "Design Entrance Exams", "Popular Programs"],
  more: ["General & Law Streams", "State Direct Hubs", "Student Tools"],
  study_abroad: ["Top Study Destinations", "Abroad Entrance Exams", "Admissions Guidance"],
  counseling: ["Institutional Counseling", "Predictor Tools", "Direct Support"],
};
