import { z } from "zod";
import { db } from "./db";

export const CollegeBulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Select at least one college.").max(10000),
  confirm: z.literal(true),
}).strict().refine(value => new Set(value.ids).size === value.ids.length, {
  path: ["ids"],
  message: "Each selected college must appear only once.",
});

export class CollegeBulkDeleteConflict extends Error {}

export async function deleteSelectedColleges(ids: string[]) {
  return db.$transaction(async tx => {
    const colleges = await tx.college.findMany({
      where: { id: { in: ids } },
      select: { id: true, slug: true },
    });
    if (colleges.length !== ids.length) {
      throw new CollegeBulkDeleteConflict("The college list has changed. Refresh the page and select colleges again. No colleges were deleted.");
    }
    // Use the same database cascades as single-college deletion. Optional lead
    // and blog links are cleared by their foreign keys, preserving those records.
    const deleted = await tx.college.deleteMany({ where: { id: { in: ids } } });
    if (deleted.count !== colleges.length) {
      throw new CollegeBulkDeleteConflict("The college list changed during deletion. Refresh and try again. No colleges were deleted.");
    }
    return { deletedCount: deleted.count, colleges };
  }, { timeout: 30000 });
}
