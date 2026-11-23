import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { checkAdminAccess } from "@/lib/auth/staff-guard";
import { z } from "zod";

const permissionsSchema = z.array(z.enum(["dashboard", "colleges", "exams", "blogs", "reviews", "leads", "seo-geo", "blogs:publish", "blogs:delete"]));
const assignedSchema = z.array(z.string().uuid());
const designationSchema = z.string().trim().max(120).regex(/^[^\u0000-\u001f\u007f]*$/).nullable().optional();

export async function GET() {
  try {
    const access = await checkAdminAccess("staff");
    if (!access.isSuperAdmin) {
      return NextResponse.json({ success: false, error: "Only Super Administrators can manage staff." }, { status: 403 });
    }

    const staffList = await db.user.findMany({
      where: {
        role: UserRole.STAFF,
      },
      include: {
        staffPermission: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const colleges = await db.college.findMany({
      select: { id: true, name: true, shortName: true },
      orderBy: { name: "asc" },
    });

    const formatted = staffList.map((staff) => ({
      id: staff.id,
      name: staff.name,
      designation: staff.designation,
      email: staff.email,
      phone: staff.phone,
      isActive: staff.isActive,
      createdAt: staff.createdAt,
      permissions: staff.staffPermission?.permissions || [],
      assignedCollegeIds: staff.staffPermission?.assignedCollegeIds || [],
    }));

    return NextResponse.json({ success: true, staff: formatted, colleges });
  } catch (error: any) {
    console.error("Error fetching staff list:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch staff members" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await checkAdminAccess("staff");
    if (!access.isSuperAdmin) {
      return NextResponse.json({ success: false, error: "Only Super Administrators can create staff." }, { status: 403 });
    }

    const body = await req.json();
    const { name, userId, password, permissions, assignedCollegeIds = [] } = body;
    const designation = designationSchema.safeParse(body.designation);
    if (!designation.success) return NextResponse.json({ error: "Designation must be a single line of up to 120 characters." }, { status: 400 });
    if (typeof name !== "string" || typeof userId !== "string" || typeof password !== "string" || password.length < 8 || !permissionsSchema.safeParse(permissions).success || !assignedSchema.safeParse(assignedCollegeIds).success) return NextResponse.json({ error: "Enter valid staff details, permissions and a password of at least 8 characters." }, { status: 400 });
    if (await db.college.count({ where: { id: { in: Array.from(new Set(assignedCollegeIds)) as string[] } } }) !== new Set(assignedCollegeIds).size) return NextResponse.json({ error: "An assigned college no longer exists." }, { status: 400 });

    if (!name || !userId || !password) {
      return NextResponse.json(
        { success: false, error: "Name, User ID/Email, and Password are required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please select at least one feature permission for this staff." },
        { status: 400 }
      );
    }

    // Format email
    const email = userId.includes("@")
      ? userId.trim().toLowerCase()
      : `${userId.trim().toLowerCase()}@admissionhere.in`;

    const existing = await db.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `A user with User ID / Email "${email}" already exists.` },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newStaff = await db.user.create({
      data: {
        name: name.trim(),
        designation: designation.data || null,
        email,
        passwordHash,
        role: UserRole.STAFF,
        isActive: true,
        staffPermission: {
          create: {
            permissions,
            assignedCollegeIds,
            isActive: true,
          },
        },
      },
      include: {
        staffPermission: true,
      },
    });

    // Record Activity Log
    try {
      await db.staffActivityLog.create({
        data: {
          staffId: newStaff.id,
          action: "CREATED_STAFF",
          details: `Staff account "${newStaff.name}" created with permissions: ${permissions.join(", ")}. Assigned colleges: ${assignedCollegeIds.length}`,
        },
      });
    } catch {
      // non-blocking
    }

    return NextResponse.json(
      {
        success: true,
        message: "Staff account created successfully.",
        staff: {
          id: newStaff.id,
          name: newStaff.name,
          designation: newStaff.designation,
          email: newStaff.email,
          isActive: newStaff.isActive,
          permissions: newStaff.staffPermission?.permissions || [],
          assignedCollegeIds: newStaff.staffPermission?.assignedCollegeIds || [],
          createdAt: newStaff.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating staff:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create staff member." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const access = await checkAdminAccess("staff");
    if (!access.isSuperAdmin) {
      return NextResponse.json({ success: false, error: "Only Super Administrators can update staff." }, { status: 403 });
    }

    const body = await req.json();
    const { id, permissions, assignedCollegeIds, isActive } = body;
    const designation = designationSchema.safeParse(body.designation);
    if (!designation.success) return NextResponse.json({ error: "Designation must be a single line of up to 120 characters." }, { status: 400 });
    if (!z.string().uuid().safeParse(id).success || (permissions !== undefined && !permissionsSchema.safeParse(permissions).success) || (assignedCollegeIds !== undefined && !assignedSchema.safeParse(assignedCollegeIds).success)) return NextResponse.json({ error: "Invalid staff account or permissions." }, { status: 400 });
    const target = await db.user.findUnique({ where: { id } });
    if (!target || target.role !== "STAFF") return NextResponse.json({ error: "Staff account not found." }, { status: 404 });
    if (assignedCollegeIds && await db.college.count({ where: { id: { in: Array.from(new Set(assignedCollegeIds)) as string[] } } }) !== new Set(assignedCollegeIds).size) return NextResponse.json({ error: "An assigned college no longer exists." }, { status: 400 });

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Staff user ID is required." },
        { status: 400 }
      );
    }

    const updateUserData: any = {};
    if (body.designation !== undefined) updateUserData.designation = designation.data || null;
    if (typeof isActive === "boolean") {
      updateUserData.isActive = isActive;
    }

    const permissionUpdateData: any = {};
    if (Array.isArray(permissions)) {
      permissionUpdateData.permissions = permissions;
    }
    if (Array.isArray(assignedCollegeIds)) {
      permissionUpdateData.assignedCollegeIds = assignedCollegeIds;
    }
    if (typeof isActive === "boolean") {
      permissionUpdateData.isActive = isActive;
    }

    const updated = await db.$transaction(async (tx) => {
      if (Object.keys(updateUserData).length > 0) {
        await tx.user.update({ where: { id }, data: updateUserData });
      }
      return tx.staffPermission.upsert({
        where: { userId: id },
        update: permissionUpdateData,
        create: {
          userId: id,
          permissions: permissions || ["colleges"],
          assignedCollegeIds: assignedCollegeIds || [],
          isActive: typeof isActive === "boolean" ? isActive : true,
        },
      });
    });

    // Record Activity Log
    try {
      await db.staffActivityLog.create({
        data: {
          staffId: id,
          action: body.designation !== undefined ? "UPDATED_STAFF_PROFILE" : "UPDATED_PERMISSIONS",
          details: `Staff details updated. Designation: ${body.designation !== undefined ? designation.data || "Not set" : target.designation || "Not set"}. Active: ${updated.isActive}, Permissions: ${updated.permissions.join(", ")}, Assigned colleges: ${updated.assignedCollegeIds.length}`,
        },
      });
    } catch {
      // non-blocking
    }

    return NextResponse.json({
      success: true,
      message: "Staff account and permissions updated successfully.",
      designation: body.designation !== undefined ? designation.data || null : target.designation,
      permissions: updated.permissions,
      assignedCollegeIds: updated.assignedCollegeIds,
      isActive: updated.isActive,
    });
  } catch (error: any) {
    console.error("Error updating staff permissions:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update permissions." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const access = await checkAdminAccess("staff");
    if (!access.isSuperAdmin) {
      return NextResponse.json({ success: false, error: "Only Super Administrators can delete staff." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid staff ID." }, { status: 400 });
    const target = await db.user.findUnique({ where: { id: id! } });
    if (!target || target.role !== "STAFF") return NextResponse.json({ error: "Staff account not found." }, { status: 404 });

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Staff user ID is required." },
        { status: 400 }
      );
    }

    await db.user.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Staff account removed permanently.",
    });
  } catch (error: any) {
    console.error("Error deleting staff:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete staff member." },
      { status: 500 }
    );
  }
}
