import { z } from "zod";
import { db } from "./db";

<<<<<<< HEAD
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
=======
import { bulkDeleteLimit } from "./college-bulk-delete-limit";

export const bulkDeleteCollegesSchema = z.object({
  ids: z.array(z.string().uuid().transform((id) => id.toLowerCase())).min(1).max(bulkDeleteLimit),
  confirm: z.literal(true),
}).strict();

export async function deleteSelectedColleges(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  const { count } = await db.college.deleteMany({ where: { id: { in: uniqueIds } } });
  return { deleted: count, missing: uniqueIds.length - count };
>>>>>>> bf39c3e1d53886ab5c3cf73c54160c1ed20f9878
}
