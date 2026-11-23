import { isSameSiteRequest } from "@/lib/security";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { LeadCtaType, LeadStatus } from "@prisma/client";
import { z } from "zod";
import { isValidStateDistrict } from "@/lib/india-locations";
import { resolveCollegeBrochures } from "@/lib/brochures";
import { auth } from "@/lib/auth/config";

const LeadCaptureSchema = z.object({
  studentName: z.string().min(2, "Name must be at least 2 characters").max(100),
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .max(16)
    .regex(/^(\+?\d{1,3})?[0-9\s\-]{10,14}$/, "Valid contact number required"),
  targetStream: z.string().min(2, "Target stream is required"),
  targetCourse: z.string().optional().nullable(),
  brochureId: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  state: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  parentPhone: z.string().optional().nullable(),
  targetCollegeId: z.string().uuid().optional().nullable(),
  sourceBlogId: z.string().uuid().optional().nullable(),
  sourceUrl: z.string().default("/"),
  ctaType: z.nativeEnum(LeadCtaType).default(LeadCtaType.APPLY_NOW),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    if (!isSameSiteRequest(req)) return NextResponse.json({ error: "Same-site requests only." }, { status: 403 });
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in to continue." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
    const body = await req.json();
    const parsed = LeadCaptureSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Validation failed";
      return NextResponse.json(
        { success: false, error: firstIssue, details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const studentId = (session?.user as any)?.role === "STUDENT" ? session!.user!.id : null;
    if (data.targetCollegeId && !await db.college.findUnique({ where: { id: data.targetCollegeId, isPublished: true }, select: { id: true } })) return NextResponse.json({ error: "College not found" }, { status: 404 });
    if ((data.state || data.district) && !isValidStateDistrict(data.state || "", data.district || "")) {
      return NextResponse.json({ success: false, error: "Select a valid state and a district belonging to that state." }, { status: 400 });
    }
    if (data.ctaType === LeadCtaType.DOWNLOAD_BROCHURE) {
      if (!data.targetCollegeId || !data.brochureId || !data.email || !data.parentPhone || !data.state || !data.district) {
        return NextResponse.json({ success: false, error: "Complete all brochure request fields." }, { status: 400 });
      }
      const college = await db.college.findUnique({ where: { id: data.targetCollegeId, isPublished: true }, select: { id: true, slug: true, brochurePdfUrl: true, courses: { select: { course: { select: { degree: true } } } } } });
      const brochure = college && resolveCollegeBrochures(college).find(item => item.id === data.brochureId);
      if (!brochure || !brochure.programs.includes(data.targetCourse || "")) {
        return NextResponse.json({ success: false, error: "Select an available brochure and a course covered by that document." }, { status: 400 });
      }
      if (!/^(?:\+91|91|0)?[6-9]\d{9}$/.test(data.parentPhone.replace(/[\s()-]/g, ""))) {
        return NextResponse.json({ success: false, error: "Enter a valid parent or guardian mobile number." }, { status: 400 });
      }
    }
    const cleanPhone = data.phone.replace(/[\s\-()]/g, "");

    // Duplicate submission prevention:
    // If student clicks repeatedly, avoid duplicate rows within 2 minutes for the same phone & college
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const existing = await db.lead.findFirst({
      where: {
        phone: cleanPhone,
        userId: studentId,
        targetCollegeId: data.targetCollegeId || null,
        ctaType: data.ctaType,
        targetCourse: data.targetCourse || null,
        createdAt: { gte: twoMinutesAgo },
      },
      include: {
        targetCollege: { select: { name: true } },
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        message: "Your application has already been received! A counselor will reach out shortly.",
        leadId: existing.id,
        status: existing.status,
        assignedCollege: existing.targetCollege?.name || "General Admissions Desk",
      });
    }

    const lead = await db.lead.create({
      data: {
        studentName: data.studentName.trim(),
        userId: studentId,
        phone: cleanPhone,
        email: data.email ? data.email.toLowerCase().trim() : null,
        state: data.state ? data.state.trim() : null,
        district: data.district ? data.district.trim() : null,
        parentPhone: data.parentPhone ? data.parentPhone.replace(/[\s\-()]/g, "") : null,
        targetStream: data.targetStream.trim(),
        targetCourse: data.targetCourse ? data.targetCourse.trim() : null,
        targetCollegeId: data.targetCollegeId || null,
        sourceBlogId: data.sourceBlogId || null,
        sourceUrl: data.sourceUrl,
        ctaType: data.ctaType,
        isBrochureDownloaded: data.ctaType === LeadCtaType.DOWNLOAD_BROCHURE,
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign,
        status: LeadStatus.NEW,
      },
      include: {
        targetCollege: {
          select: { name: true, slug: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Application successfully submitted and routed to the admissions desk.",
      leadId: lead.id,
      status: lead.status,
      assignedCollege: lead.targetCollege?.name || "General Admissions Desk",
    });
  } catch (error: any) {
    console.error("Lead capture API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit application. Please try again." },
      { status: 500 }
    );
  }
}
