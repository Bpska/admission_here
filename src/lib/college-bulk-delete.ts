import { z } from "zod";
import { db } from "./db";

import { bulkDeleteLimit } from "./college-bulk-delete-limit";

export const bulkDeleteCollegesSchema = z.object({
  ids: z.array(z.string().uuid().transform((id) => id.toLowerCase())).min(1).max(bulkDeleteLimit),
  confirm: z.literal(true),
}).strict();

export async function deleteSelectedColleges(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  const { count } = await db.college.deleteMany({ where: { id: { in: uniqueIds } } });
  return { deleted: count, missing: uniqueIds.length - count };
}
