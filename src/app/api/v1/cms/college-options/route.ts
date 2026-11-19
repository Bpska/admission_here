import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/auth/staff-guard";
import { db } from "@/lib/db";

export async function GET() {
  const access = await checkAdminAccess("colleges");
  if (!access.allowed) return NextResponse.json({ error: "College access required." }, { status: 403 });
  const [courses, exams] = await Promise.all([
    db.course.findMany({ select: { id: true, fullName: true, degree: true }, orderBy: { fullName: "asc" } }),
    db.exam.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return NextResponse.json({ courses, exams });
}
