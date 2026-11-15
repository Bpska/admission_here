import locations from "@/data/india-states-districts.json";

// Source: CodingMation/indian-states-districts (MIT); notice in src/data.
export const INDIAN_STATES = Object.keys(locations);
export function getDistricts(state: string): string[] {
  return (locations as Record<string, string[]>)[state] || [];
}
export function isValidStateDistrict(state: string, district: string) {
  return Object.hasOwn(locations, state) && getDistricts(state).includes(district);
}
