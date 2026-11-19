import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAccess, collegeScope } from "@/lib/auth/staff-guard";
import { OwnershipType, ApprovalActionType, ApprovalStatus } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createCollegeProfile } from "@/lib/create-college-profile";
import { validateCustomNavbarFilter } from "@/lib/custom-navbar-filters";
import { CollegeCreateSchema } from "@/lib/college-validation";



export async function GET() {
  try {
    const access = await checkAdminAccess("colleges");
    if (!access.allowed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const colleges = await db.college.findMany({
      where: collegeScope(access),
      orderBy: [{ nirfRank: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { courses: true, reviews: true, leads: true } },
      },
    });

    return NextResponse.json({ success: true, colleges });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch colleges" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await checkAdminAccess("colleges");
    if (!access.allowed) {
      return NextResponse.json({ error: "Unauthorized access: colleges permission required" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CollegeCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid college parameters", details: parsed.error.format() },
        { status: 400 }
      );
    }

    await validateCustomNavbarFilter(db, parsed.data);

    // Check slug collision
    const existing = await db.college.findUnique({
      where: { slug: parsed.data.slug },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: `A college with URL slug "${parsed.data.slug}" already exists.` },
        { status: 409 }
      );
    }

    // Staff workflow: Submit for Admin Approval
    if (access.role === "STAFF") {
      const approvalRequest = await db.collegeApprovalRequest.create({
        data: {
          staffId: access.userId,
          actionType: ApprovalActionType.CREATE,
          section: "ALL",
          title: `Onboard New College Profile: ${parsed.data.name}`,
          proposedData: parsed.data,
          status: ApprovalStatus.PENDING,
        },
      });

      // Audit Log
      try {
        await db.staffActivityLog.create({
          data: {
            staffId: access.userId,
            action: "SUBMITTED_CHANGES",
            details: `Staff ${access.userName} submitted new college "${parsed.data.name}" for admin approval.`,
          },
        });
      } catch {}

      return NextResponse.json({
        success: true,
        pendingApproval: true,
        message: "New college submission safely stored and sent for Administrator review & publishing approval.",
        requestId: approvalRequest.id,
      });
    }

    // Super Admin: direct publication
    const college = await db.$transaction(tx => createCollegeProfile(tx, parsed.data, access.userId));

    try {
      revalidatePath("/", "layout");
      revalidatePath("/colleges");
      revalidatePath(`/college/${college.slug}`);
      revalidatePath("/sitemap.xml");
    } catch {
      // non-blocking
    }

    return NextResponse.json({
      success: true,
      message: "College profile onboarded successfully.",
      college,
    });
  } catch (err: any) {
    console.error("College create error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create college profile" },
      { status: 500 }
    );
  }
}
