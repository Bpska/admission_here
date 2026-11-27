import type { OwnershipType } from "@prisma/client";

export const COLLEGE_OWNERSHIP_LABELS = {
  PUBLIC_GOVERNMENT: "Public / Government",
  PRIVATE: "Private",
  DEEMED: "Deemed to be University",
  AUTONOMOUS: "Autonomous",
  AIDED: "Government Aided",
} satisfies Record<OwnershipType, string>;

export function isCollegeOwnershipType(value: string): value is OwnershipType {
  return Object.hasOwn(COLLEGE_OWNERSHIP_LABELS, value);
}

export function collegeOwnershipLabel(value: string) {
  return isCollegeOwnershipType(value)
    ? COLLEGE_OWNERSHIP_LABELS[value]
    : value.replace(/_/g, " ");
}
