import { z } from "zod";

export const collegeSlugSchema = z.string().trim().toLowerCase().min(2).max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a short URL name such as nit-rourkela, without https://, slashes, or spaces. Put the college website in Website URL.");

export function slugifyCollegeName(name: string) {
  return name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "");
}
