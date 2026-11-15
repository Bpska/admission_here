import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAccess, canAccessCollege } from "@/lib/auth/staff-guard";
import { revalidatePath } from "next/cache";
import { OwnershipType, ApprovalActionType, ApprovalStatus } from "@prisma/client";
import { z } from "zod";
import { CollegeUpdateSchema } from "@/lib/college-validation";



export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await checkAdminAccess("colleges");
    if (!access.allowed) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { id } = await params;
    if (!canAccessCollege(access, id)) return NextResponse.json({ error: "College is not assigned to your account." }, { status: 403 });
    const college = await db.college.findUnique({
      where: { id },
      include: {
        courses: { include: { course: true } },
        placements: true,
        rankings: true,
      },
    });

    if (!college) {
      return NextResponse.json({ error: "College not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, college });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch college" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await checkAdminAccess("colleges");
    if (!access.allowed) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { id } = await params;
    if (!canAccessCollege(access, id)) return NextResponse.json({ error: "College is not assigned to your account." }, { status: 403 });
    const body = await req.json();
    const parsed = CollegeUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const existingCollege = await db.college.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    });

    if (!existingCollege) {
      return NextResponse.json({ error: "College not found" }, { status: 404 });
    }

    // Staff workflow: Must submit for Admin Approval
    if (access.role === "STAFF") {
      const approvalRequest = await db.collegeApprovalRequest.create({
        data: {
          collegeId: id,
          staffId: access.userId,
          actionType: ApprovalActionType.UPDATE,
          section: "ALL",
          title: `Update College Details: ${existingCollege.name}`,
          proposedData: parsed.data,
          status: ApprovalStatus.PENDING,
        },
      });

      // Audit Log
      try {
        await db.staffActivityLog.create({
          data: {
            staffId: access.userId,
            collegeId: id,
            action: "SUBMITTED_CHANGES",
            details: `Staff ${access.userName} submitted revisions for "${existingCollege.name}" for admin approval.`,
          },
        });
      } catch {}

      return NextResponse.json({
        success: true,
        pendingApproval: true,
        message: "Your revisions have been submitted to the Administrator for approval and will publish once approved.",
        requestId: approvalRequest.id,
      });
    }

    // Super Admin: direct update
    const updated = await db.college.update({
      where: { id },
      data: parsed.data,
    });

    // Revalidate public caches
    try {
      revalidatePath("/", "layout");
      revalidatePath("/colleges");
      revalidatePath(`/colleges/${updated.slug}`);
      revalidatePath(`/college/${updated.slug}`);
      revalidatePath("/sitemap.xml");
    } catch {
      // non-blocking
    }

    return NextResponse.json({
      success: true,
      message: "College profile updated successfully.",
      college: updated,
    });
  } catch (error: any) {
    console.error("College update error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update college profile" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await checkAdminAccess("colleges");
    if (!access.allowed) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    // Staff members cannot delete colleges or records
    if (access.role === "STAFF") {
      return NextResponse.json(
        { error: "Staff members cannot delete colleges or existing records. Only Super Administrators can delete colleges." },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!canAccessCollege(access, id)) return NextResponse.json({ error: "College is not assigned to your account." }, { status: 403 });
    const existing = await db.college.findUnique({ where: { id }, select: { slug: true, name: true } });

    if (!existing) {
      return NextResponse.json({ error: "College not found" }, { status: 404 });
    }

    await db.college.delete({ where: { id } });

    try {
      revalidatePath("/", "layout");
      revalidatePath("/colleges");
      revalidatePath(`/college/${existing.slug}`);
    } catch {
      // non-blocking
    }

    return NextResponse.json({
      success: true,
      message: "College deleted successfully.",
    });
  } catch (error: any) {
    console.error("College delete error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete college" },
      { status: 500 }
    );
  }
}
