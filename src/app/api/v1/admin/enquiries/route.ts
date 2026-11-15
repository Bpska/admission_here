import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAccess, collegeScope, canAccessCollege } from "@/lib/auth/staff-guard";
import { LeadStatus, LeadCtaType } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const access = await checkAdminAccess("leads");
    if (!access.allowed) {
      return NextResponse.json({ error: "Unauthorized access: enquiries permission required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const collegeId = searchParams.get("collegeId") || "";
    const ctaType = searchParams.get("ctaType") || "";
    const status = searchParams.get("status") || "";
    const exportCsv = searchParams.get("export") === "csv";
    const exportExcel = searchParams.get("export") === "xlsx";

    const where: any = access.isSuperAdmin ? {} : { targetCollegeId: { in: access.assignedCollegeIds || [] } };

    if (search) {
      where.OR = [
        { studentName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { targetCourse: { contains: search, mode: "insensitive" } },
        { targetCollege: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (collegeId && collegeId !== "ALL") {
      if (!canAccessCollege(access, collegeId)) return NextResponse.json({ error: "College access denied" }, { status: 403 });
      where.targetCollegeId = collegeId;
    }

    if (ctaType && ctaType !== "ALL") {
      where.ctaType = ctaType as LeadCtaType;
    }

    if (status && status !== "ALL") {
      where.status = status as LeadStatus;
    }

    if (ctaType && ctaType !== "ALL" && !Object.values(LeadCtaType).includes(ctaType as LeadCtaType)) return NextResponse.json({error:"Invalid enquiry type"},{status:400});
    if (status && status !== "ALL" && !Object.values(LeadStatus).includes(status as LeadStatus)) return NextResponse.json({error:"Invalid enquiry status"},{status:400});

    const leads = await db.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        targetCollege: { select: { id: true, name: true, slug: true, city: true, state: true } },
      },

    });

    if (exportExcel) {
      const { Workbook } = await import("exceljs");
      const workbook = new Workbook();
      workbook.creator = "Admission Here";
      const sheet = workbook.addWorksheet("Student leads", {views:[{state:"frozen", ySplit:1}]});
      sheet.columns = [
        {header:"Enquiry ID",key:"id",width:38}, {header:"Student Name",key:"studentName",width:28},
        {header:"Contact Number",key:"phone",width:20}, {header:"Email",key:"email",width:32},
        {header:"State",key:"state",width:22}, {header:"District",key:"district",width:22},
        {header:"Parent Contact",key:"parentPhone",width:20}, {header:"Target Course",key:"targetCourse",width:28},
        {header:"Target Stream",key:"targetStream",width:22}, {header:"College Name",key:"college",width:42},
        {header:"Enquiry Type",key:"ctaType",width:26}, {header:"Status",key:"status",width:26},
        {header:"Counselor Notes",key:"counselorNotes",width:45}, {header:"Source URL",key:"sourceUrl",width:40},
        {header:"Submitted At (UTC)",key:"submittedAt",width:28},
      ];
      for (const lead of leads) sheet.addRow({...lead, college:lead.targetCollege?.name || "General Desk", submittedAt:lead.createdAt.toISOString()});
      // Text values stay strings, including phone numbers and formula-like user input.
      for (const key of ["phone", "parentPhone"]) sheet.getColumn(key).numFmt = "@";
      sheet.getRow(1).font = {bold:true};
      sheet.autoFilter = {from:{row:1,column:1},to:{row:Math.max(1,sheet.rowCount),column:sheet.columnCount}};
      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(new Uint8Array(buffer), {headers:{
        "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":`attachment; filename="admission-leads-${new Date().toISOString().slice(0,10)}.xlsx"`,
        "Cache-Control":"private, no-store",
      }});
    }

    if (exportCsv) {
      const headers = [
        "Enquiry ID",
        "Student Name",
        "Contact Number",
        "Email",
        "State",
        "District",
        "Parent Contact",
        "Target Course",
        "Target Stream",
        "College Name",
        "Enquiry Type",
        "Status",
        "Counselor Notes",
        "Submission Timestamp",
      ];

      const csvRows = [headers.join(",")];

      leads.forEach((l) => {
        const row = [
          `"${l.id}"`,
          `"${(l.studentName || "").replace(/"/g, '""')}"`,
          `"${l.phone}"`,
          `"${l.email || ""}"`,
          `"${l.state || ""}"`,
          `"${l.district || ""}"`,
          `"${l.parentPhone || ""}"`,
          `"${l.targetCourse || ""}"`,
          `"${l.targetStream || ""}"`,
          `"${(l.targetCollege?.name || "General Desk").replace(/"/g, '""')}"`,
          `"${l.ctaType}"`,
          `"${l.status}"`,
          `"${(l.counselorNotes || "").replace(/"/g, '""')}"`,
          `"${l.createdAt.toISOString()}"`,
        ];
        csvRows.push(row.join(","));
      });

      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="admision-enquiries-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const colleges = await db.college.findMany({
      where: collegeScope(access),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      success: true,
      leads,
      colleges,
      totalCount: leads.length,
    });
  } catch (error: any) {
    console.error("Enquiries API error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch enquiries" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await checkAdminAccess("leads");
    if (!access.allowed) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await req.json();
    const { id, status, counselorNotes } = body;

    if (!id) {
      return NextResponse.json({ error: "Enquiry ID required" }, { status: 400 });
    }

    const lead = await db.lead.findUnique({ where: { id } });
    if (!lead) return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
    if (!access.isSuperAdmin && (!lead.targetCollegeId || !canAccessCollege(access, lead.targetCollegeId))) return NextResponse.json({ error: "Enquiry access denied" }, { status: 403 });
    if (status && !Object.values(LeadStatus).includes(status)) return NextResponse.json({ error: "Invalid enquiry status" }, { status: 400 });
    const updated = await db.lead.update({
      where: { id },
      data: {
        ...(status ? { status: status as LeadStatus } : {}),
        ...(counselorNotes !== undefined ? { counselorNotes } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Enquiry status updated successfully",
      lead: updated,
    });
  } catch (error: any) {
    console.error("Enquiries update error:", error);
    return NextResponse.json({ error: error.message || "Failed to update enquiry" }, { status: 500 });
  }
}

