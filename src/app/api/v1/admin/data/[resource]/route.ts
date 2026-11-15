import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ADMIN_RESOURCES } from "@/lib/admin-data-config";
import { DATA_SCHEMAS, DATA_MODELS, applyDataMutation, parseDataMutation, type DataResource } from "@/lib/admin-data";
import { checkAdminAccess, canAccessCollege } from "@/lib/auth/staff-guard";

const scoped = ["offerings", "cutoffs", "placements", "rankings"];
const json = (value: unknown, status = 200) => NextResponse.json(JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item)), { status });
const bodySchema = z.object({ id: z.string().uuid().optional(), collegeId: z.string().uuid().optional(), data: z.record(z.unknown()).default({}) });

async function handle(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource: key } = await context.params;
    if (!Object.hasOwn(DATA_SCHEMAS, key)) return json({ error: "Unknown resource" }, 404);
    const resource = key as DataResource;
    const access = await checkAdminAccess(ADMIN_RESOURCES[resource].feature);
    if (!access.allowed || (resource === "users" && !access.isSuperAdmin)) return json({ error: "Access denied" }, 403);
    const url = new URL(request.url);
    const body = request.method === "GET" ? {} : bodySchema.parse(await request.json());
    const { id, data = {} } = body as z.infer<typeof bodySchema>;
    const collegeId = (body as z.infer<typeof bodySchema>).collegeId || url.searchParams.get("collegeId") || undefined;
    if (scoped.includes(resource)) {
      if (!z.string().uuid().safeParse(collegeId).success) return json({ error: "Select a college." }, 400);
      if (!canAccessCollege(access, collegeId!)) return json({ error: "College is not assigned to you." }, 403);
      if (!await db.college.findUnique({ where: { id: collegeId } })) return json({ error: "College not found" }, 404);
    }
    if (resource === "courses" && request.method !== "GET" && !access.isSuperAdmin) return json({ error: "Only Super Administrators can change the shared course catalog." }, 403);
    if (request.method === "GET") {
      const where = resource === "users" ? { role: { not: "STAFF" } } : resource === "cutoffs" ? { collegeCourse: { collegeId } } : scoped.includes(resource) ? { collegeId } : {};
      const include = resource === "offerings" ? { course: true } : resource === "cutoffs" ? { exam: true, collegeCourse: { include: { course: true } } } : undefined;
      const rows = resource === "users"
        ? await db.user.findMany({ where: { role: { not: "STAFF" } }, select: { id: true, name: true, email: true, phone: true, role: true, managedCollegeId: true, isActive: true }, orderBy: { name: "asc" } })
        : await (db as any)[DATA_MODELS[resource]].findMany({ where, include, orderBy: { id: "asc" } });
      const options: Record<string, unknown> = {};
      if (resource === "offerings") options.courses = await db.course.findMany({ select: { id: true, fullName: true, degree: true }, orderBy: { fullName: "asc" } });
      if (resource === "cutoffs") {
        options.offerings = await db.collegeCourse.findMany({ where: { collegeId }, include: { course: true } });
        options.exams = await db.exam.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
      }
      if (resource === "users") options.colleges = await db.college.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
      return json({ rows, options, readOnly: resource === "courses" && !access.isSuperAdmin });
    }
    const operation: "create" | "update" | "delete" = request.method === "POST" ? "create" : request.method === "PATCH" ? "update" : "delete";
    if (operation !== "create" && !id) return json({ error: "Record ID required" }, 400);
    const parsed = parseDataMutation(resource, operation, data);
    const mutation = { resource, operation, id, collegeId, data: parsed };
    // Staff college data edits use the same approval flow as profile changes.
    if (access.role === "STAFF" && scoped.includes(resource)) {
      // Validate references/ownership without committing the mutation.
      const invalid = { invalid: false, message: "" };
      try {
        await db.$transaction(async tx => { await applyDataMutation(tx, mutation, access.userId); throw new Error("QA_VALIDATE_ROLLBACK"); });
      } catch (error) { if (!(error instanceof Error) || error.message !== "QA_VALIDATE_ROLLBACK") { invalid.invalid = true; invalid.message = error instanceof Error ? error.message : "Invalid change"; } }
      if (invalid.invalid) return json({ error: invalid.message }, 400);
      const approval = await db.collegeApprovalRequest.create({ data: { collegeId, staffId: access.userId, actionType: operation === "create" ? "CREATE" : "UPDATE", section: resource.toUpperCase(), title: `${operation}: ${ADMIN_RESOURCES[resource].label}`, proposedData: JSON.parse(JSON.stringify({ __resourceMutation: mutation })), status: "PENDING" } });
      return json({ success: true, pendingApproval: true, requestId: approval.id, message: "Submitted for administrator approval. Public data will update after approval." });
    }
    const row = await db.$transaction(tx => applyDataMutation(tx, mutation, access.userId), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/", "layout");
    return json({ success: true, row: resource === "users" ? { id: row.id } : row });
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: error.issues[0]?.message || "Invalid data" }, 400);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return json({ error: "A record with these unique details already exists." }, 409);
      if (error.code === "P2003") return json({ error: "This record is linked to other data. Remove those links before deleting it." }, 409);
      if (error.code === "P2034") return json({ error: "Another update was made at the same time. Refresh and try again." }, 409);
    }
    return json({ error: error instanceof Error ? error.message : "Unable to save record" }, 400);
  }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
