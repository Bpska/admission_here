import { z } from "zod";
import { NAVBAR_CATEGORY_VALUES } from "./navbar-categories";
import { slugifyCollegeName } from "./college-slug";
import { db } from "@/lib/db";
import { NAVBAR_COLUMN_TITLES, type NavbarCategory } from "./navbar-categories";
import { NAVBAR_FILTERS, type NavbarFilterOption } from "./navbar-filters";
import type { Prisma } from "@prisma/client";

type StoredFilter = { id: string; slug: string; label: string; category: string; section: string };
export function customFilterOption(row: StoredFilter): NavbarFilterOption {
  return { ...row, custom: true, sectionLabel: NAVBAR_COLUMN_TITLES[row.category as NavbarCategory]?.[Number(row.section.slice(-1)) - 1] || "Colleges", href: `/colleges/sections/${row.slug}` };
}
export async function getCustomNavbarFilters(publicOnly = false, client: Pick<Prisma.TransactionClient, "navbarFilter" | "college"> = db) {
  const rows = await client.navbarFilter.findMany({ orderBy: { label: "asc" } });
  if (!publicOnly) return rows.map(customFilterOption);
  const assignments = await client.college.findMany({ where: { isPublished: true, showInNavbar: true, navbarFilter: { in: rows.map(row => row.id) } }, select: { navbarFilter: true } });
  const active = new Set(assignments.map(row => row.navbarFilter));
  return rows.filter(row => active.has(row.id)).map(customFilterOption);
}
export async function findNavbarFilter(id?: string): Promise<NavbarFilterOption | undefined> {
  if (!id) return undefined;
  return NAVBAR_FILTERS.find(row => row.id === id) || (await getCustomNavbarFilters(true)).find(row => row.id === id);
}
export async function validateCustomNavbarFilter(tx: Prisma.TransactionClient, data: { navbarFilter?: string | null }) {
  if (data.navbarFilter?.startsWith("custom:") && !await tx.navbarFilter.findUnique({ where: { id: data.navbarFilter } })) throw new Error("This section no longer exists. Choose an existing section or save a new one.");
}

export const NavbarFilterInputSchema = z.object({ label: z.string().trim().min(2).max(120), category: z.enum(NAVBAR_CATEGORY_VALUES), section: z.enum(["column_1", "column_2", "column_3"]) });
export async function saveCustomNavbarFilter(tx: Prisma.TransactionClient, input: unknown) {
  const data = NavbarFilterInputSchema.parse(input);
  const label = data.label.replace(/\s+/g, " ");
  const match = NAVBAR_FILTERS.find(row => row.category === data.category && row.label.toLowerCase() === label.toLowerCase());
  if (match) return match;
  const name = slugifyCollegeName(label);
  if (!name) throw new Error("Use a section name containing letters or numbers.");
  const slug = `${data.category}-${name}`;
  const id = `custom:${data.category}:${data.section}:${slug}`;
  const row = await tx.navbarFilter.upsert({ where: { slug }, create: { ...data, label, slug, id }, update: {} });
  if (row.label.toLowerCase() !== label.toLowerCase()) throw new Error("A similar section URL already exists. Choose a more specific name.");
  return customFilterOption(row);
}
