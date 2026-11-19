import { z } from "zod";
import { BlogCategory } from "@prisma/client";

export const CollegeInitialBlogSchema = z.object({
  title: z.string().trim().min(3, "Enter a blog title of at least 3 characters.").max(200),
  contentMdx: z.string().trim().min(10, "Write the college blog article before saving.").max(200000).refine(value => value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").trim().length >= 10, "Write at least 10 characters of blog text."),
  category: z.nativeEnum(BlogCategory).default(BlogCategory.COLLEGE_ROUNDUP),
  featuredImageUrl: z.string().regex(/^\/api\/v1\/blog-images\/[a-f0-9-]{36}$/i, "Upload the blog cover using the file picker.").nullable().optional(),
  metaDescription: z.string().trim().max(500).optional(),
  showOnWebsiteBlog: z.boolean().default(false),
  publish: z.boolean().default(false),
});
