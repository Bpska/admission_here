import { CATEGORIES, type SubItem } from "./navbar-items";

const SPECIALIZATIONS: Record<string, string> = {
  "Computer Science (CSE)": "Computer Science", "Artificial Intelligence & ML": "Artificial Intelligence",
  "Electronics & Communication": "Electronics", "Mechanical Engineering": "Mechanical", "Civil Engineering": "Civil",
  "MBA in Finance": "Finance", "MBA in Marketing": "Marketing", "MBA in Human Resources": "Human Resources",
  "MBA in Business Analytics": "Business Analytics", "Executive MBA Programs": "Executive",
};

export const NAVBAR_FILTERS = CATEGORIES.flatMap(category => category.columns.flatMap((column, index) =>
  column.items.filter(item => item.href === "/colleges" || item.href.startsWith("/colleges/") || item.href.startsWith("/colleges?")).map(item => ({
    id: `${category.key}:column_${index + 1}:${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}`,
    category: category.key, section: `column_${index + 1}`, sectionLabel: column.title,
    label: item.label, href: item.href,
    specialization: SPECIALIZATIONS[item.label],
  }))));

export function defaultNavbarFilter(category?: string | null, section?: string | null) {
  return NAVBAR_FILTERS.find(item => item.category === category && (section === "featured" || !section || item.section === section))
    || NAVBAR_FILTERS.find(item => item.category === category);
}

export function navbarFilterHref(category: string, column: number, item: SubItem) {
  const filter = NAVBAR_FILTERS.find(filter => filter.category === category && filter.section === `column_${column + 1}` && filter.label === item.label);
  if (!filter) return item.href;
  return `${item.href}${item.href.includes("?") ? "&" : "?"}navFilter=${encodeURIComponent(filter.id)}`;
}
