import { z } from "zod";
import { OwnershipType } from "@prisma/client";
import { collegeSlugSchema } from "./college-slug";
import { NAVBAR_CATEGORY_VALUES, NAVBAR_SECTION_VALUES } from "./navbar-categories";
import { NAVBAR_FILTERS, defaultNavbarFilter } from "./navbar-filters";

const navbarFilterSchema = z.string().nullable().optional().refine(value => !value || NAVBAR_FILTERS.some(filter => filter.id === value), "Choose an existing navbar filter.");
function assignNavbarFilter<T extends { showInNavbar?: boolean; navbarCategory?: string | null; navbarSection?: string; navbarFilter?: string | null }>(data: T) {
  const filter = data.navbarFilter ? NAVBAR_FILTERS.find(filter => filter.id === data.navbarFilter)
    : data.showInNavbar || data.navbarCategory ? defaultNavbarFilter(data.navbarCategory, data.navbarSection) : undefined;
  return filter ? { ...data, navbarFilter: filter.id, navbarCategory: filter.category, navbarSection: filter.section } : data;
}

export const CollegeCreateSchema = z.object({
  name: z.string().min(2, "College name must be at least 2 characters"),
  shortName: z.string().optional().nullable(),
  slug: collegeSlugSchema,
  logoUrl: z.string().optional().nullable(),
  coverImageUrl: z.string().optional().nullable(),
  brochurePdfUrl: z.string().optional().nullable(),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().optional().nullable(),
  fullAddress: z.string().optional().nullable(),
  websiteUrl: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  contactEmail: z.string().optional().nullable(),
  estYear: z.number().nullable().optional(),
  ownershipType: z.nativeEnum(OwnershipType).default(OwnershipType.PUBLIC_GOVERNMENT),
  nirfRank: z.number().nullable().optional(),
  naacGrade: z.string().optional().nullable(),
  campusAreaAcres: z.number().nullable().optional(),
  overviewHtml: z.string().default("<p>Institutional overview and campus highlights...</p>"),
  admissionHtml: z.string().optional().nullable(),
  scholarshipInfo: z.string().optional().nullable(),
  hostelInfo: z.string().optional().nullable(),
  facilitiesJson: z.any().optional(),
  faqsJson: z.any().optional(),
  qnaJson: z.any().optional(),
  galleryUrls: z.array(z.string()).default([]),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
  isPublished: z.boolean().default(true),
  showInNavbar: z.boolean().default(false),
  navbarCategory: z.enum(NAVBAR_CATEGORY_VALUES).nullable().optional(),
  navbarSection: z.enum(NAVBAR_SECTION_VALUES).default("featured"),
  navbarFilter: navbarFilterSchema,
}).refine(data => !data.showInNavbar || Boolean(data.navbarCategory), {
  path: ["navbarCategory"], message: "Select a navbar category when showing this college in the navbar.",
}).transform(assignNavbarFilter);

export const CollegeUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  shortName: z.string().nullable().optional(),
  slug: collegeSlugSchema.optional(),
  logoUrl: z.string().nullable().optional(),
  coverImageUrl: z.string().nullable().optional(),
  brochurePdfUrl: z.string().nullable().optional(),
  city: z.string().min(2).optional(),
  state: z.string().min(2).optional(),
  pincode: z.string().nullable().optional(),
  fullAddress: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  estYear: z.number().nullable().optional(),
  ownershipType: z.nativeEnum(OwnershipType).optional(),
  nirfRank: z.number().nullable().optional(),
  naacGrade: z.string().nullable().optional(),
  campusAreaAcres: z.number().nullable().optional(),
  overviewHtml: z.string().optional(),
  admissionHtml: z.string().nullable().optional(),
  scholarshipInfo: z.string().nullable().optional(),
  hostelInfo: z.string().nullable().optional(),
  facilitiesJson: z.any().optional(),
  faqsJson: z.any().optional(),
  qnaJson: z.any().optional(),
  galleryUrls: z.array(z.string()).optional(),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  showInNavbar: z.boolean().optional(),
  navbarCategory: z.enum(NAVBAR_CATEGORY_VALUES).nullable().optional(),
  navbarSection: z.enum(NAVBAR_SECTION_VALUES).optional(),
  navbarFilter: navbarFilterSchema,
}).refine(data => !data.showInNavbar || Boolean(data.navbarCategory), {
  path: ["navbarCategory"], message: "Select a navbar category when showing this college in the navbar.",
}).transform(assignNavbarFilter);
