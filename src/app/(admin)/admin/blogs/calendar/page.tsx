import Link from "next/link";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { db } from "@/lib/db";
import { checkAdminAccess } from "@/lib/auth/staff-guard";
import { StaffAccessDenied } from "@/components/admin/StaffAccessDenied";
import { publishDueScheduledBlogs } from "@/lib/blog-schedule";
import { staffDisplayName } from "@/lib/staff-display";
import { BlogScheduleCalendar } from "@/components/admin/BlogScheduleCalendar";

export const revalidate = 0;

export default async function AdminBlogCalendarPage() {
  const access = await checkAdminAccess("blogs");
  if (!access.allowed) {
    return (
      <StaffAccessDenied
        featureName="Blog Schedule Calendar"
        allowedFeatures={access.permissions}
      />
    );
  }

  await publishDueScheduledBlogs();

  const [posts, colleges] = await Promise.all([
    db.blogPost.findMany({
      where: access.isSuperAdmin ? {} : { authorId: access.userId },
      orderBy: [{ publishedAt: "asc" }, { createdAt: "desc" }],
      include: {
        author: { select: { name: true, designation: true } },
      },
    }),
    db.college.findMany({
      where: { isPublished: true },
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    }),
  ]);

  const canPublish =
    access.isSuperAdmin ||
    access.permissions.includes("blogs") ||
    access.permissions.includes("blogs:publish");

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/blogs"
            className="p-2 rounded-lg border hover:bg-accent text-muted-foreground"
            aria-label="Back to blogs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
              <CalendarClock className="w-6 h-6 text-purple-700" />
              <span>Blog Schedule Calendar</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              View all scheduled and published posts on a full calendar, or write and schedule multiple blogs for different dates and times.
            </p>
          </div>
        </div>
      </div>

      <BlogScheduleCalendar
        initialPosts={posts.map((p) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          category: p.category,
          status: p.status,
          showOnWebsiteBlog: p.showOnWebsiteBlog,
          publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
          createdAt: p.createdAt.toISOString(),
          authorName: staffDisplayName(p.author),
        }))}
        colleges={colleges}
        basePath="/admin/blogs"
        canPublish={canPublish}
      />
    </div>
  );
}
