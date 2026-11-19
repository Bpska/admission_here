import { z } from "zod";
import { DATA_SCHEMAS } from "./admin-data";

export const CollegeOnboardingSchema = z.object({
  offerings: z.array(DATA_SCHEMAS.offerings.extend({ clientId: z.string().uuid() })).max(100).default([]),
  cutoffs: z.array(DATA_SCHEMAS.cutoffs).max(500).default([]),
  placements: z.array(DATA_SCHEMAS.placements).max(100).default([]),
  rankings: z.array(DATA_SCHEMAS.rankings).max(100).default([]),
}).superRefine((data, context) => {
  const ids = new Set(data.offerings.map(row => row.clientId));
  if (ids.size !== data.offerings.length) context.addIssue({ code: 'custom', path: ['offerings'], message: 'Course references must be unique.' });
  data.offerings.forEach((row, index) => {
    if (!row.courseId && (!row.courseName || !row.degree || !row.stream || !row.level)) context.addIssue({ code: "custom", path: ["offerings", index], message: "Enter the course name, degree, stream and level." });
  });
  data.cutoffs.forEach((row, index) => {
    if (!ids.has(row.collegeCourseId)) context.addIssue({ code: 'custom', path: ['cutoffs', index, 'collegeCourseId'], message: 'Select a course added to this college.' });
    if (row.openingRank && row.closingRank && row.openingRank > row.closingRank) context.addIssue({ code: 'custom', path: ['cutoffs', index], message: 'Opening rank must not exceed closing rank.' });
  });
});
