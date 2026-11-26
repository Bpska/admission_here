import { staffDisplayName } from "@/lib/staff-display";
import { BlogMobileList } from "@/components/admin/BlogMobileList";
import { BlogCmsFilters } from "@/components/admin/BlogCmsFilters";
import { filterBlogArticles, type BlogCmsFilters as Filters } from "@/lib/blog-cms";
import { canonicalBlogHref } from "@/lib/blog-destination";
import { BlogDestinationTabs } from "@/components/admin/BlogDestinationTabs";
import { getBlogStats } from "@/lib/blog-analytics";
import { BlogAnalyticsCards } from "@/components/admin/BlogAnalyticsCards";
import { publishDueScheduledBlogs } from "@/lib/blog-schedule";
import { checkAdminAccess } from "@/lib/auth/staff-guard";
import { StaffAccessDenied } from "@/components/admin/StaffAccessDenied";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import Link from "next/link";
import {
  Plus,
  Edit,
  Eye,
  FileText,
  CheckCircle2,
  Clock,
  Radio,
  Trash2,
  CalendarClock,
} from "lucide-react";
import { StaffBlogActions } from "./StaffBlogActions";

export const revalidate = 0;

const STATUS_STYLES: Record<string, string> = {
  PUBLISHED: "bg-emerald-100 text-emerald-800",
  DRAFT: "bg-amber-100 text-amber-800",
  IN_REVIEW: "bg-blue-100 text-blue-800",
  SCHEDULED: "bg-purple-100 text-purple-800",
  ARCHIVED: "bg-gray-100 text-gray-700",
};

export default async function StaffBlogDashboardPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const requestedFilters = await searchParams;
  const filters = { ...requestedFilters, destination: requestedFilters.destination === "college" ? "college" : "website" };
  const { destination } = filters;
  const sectionPath = `/admin/staff-blogs/${destination}`;
  // Must have blogs permission
  const access = await checkAdminAccess("blogs");
  if (!access.allowed) {
    return (
      <StaffAccessDenied
        featureName="Blog Desk"
        allowedFeatures={access.permissions}
      />
    );
  }

  // Get the current user from session
  const session = await auth();
  const user = session?.user as any;
  const userId: string | undefined = user?.id;
  const isSuperAdmin = access.isSuperAdmin;

  // Determine the permissions for this user
  const permissions: string[] = user?.permissions || [];
  const canPublish =
    isSuperAdmin ||
    permissions.includes("blogs:publish") ||
    permissions.includes("blogs");
  const canDelete =
    isSuperAdmin ||
    permissions.includes("blogs:delete") ||
    permissions.includes("blogs");

  await publishDueScheduledBlogs();

  // Fetch only posts authored by this staff member (or all for SUPER_ADMIN)
  const allPosts = await db.blogPost.findMany({
    where: isSuperAdmin ? undefined : { authorId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { name: true, designation: true } },
    },
  });

  const { matching, posts, page, pages } = filterBlogArticles(allPosts, filters);
  const publicHrefs = new Map(await Promise.all(posts.map(async post => [post.id, await canonicalBlogHref(post)] as const)));


  const totalPosts = matching.length;
  const publishedPosts = matching.filter((p) => p.status === "PUBLISHED").length;
  const draftPosts = matching.filter((p) => p.status === "DRAFT").length;
  const livePosts = matching.filter((p) => p.isLiveBlog).length;

  const analytics = await getBlogStats(matching.map(post => post.id));

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black"
              style={{ background: "#b45309" }}
            >
              <FileText className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              {destination === "college" ? "College Blogs" : "Website Blogs"}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            {isSuperAdmin
              ? "Full editorial control across all staff blog posts."
              : `Welcome back, ${staffDisplayName({ name: access.userName, designation: access.userDesignation })}! Manage your assigned blog articles below.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/staff-blogs/calendar"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-purple-300 bg-purple-50 text-purple-800 text-xs font-bold hover:bg-purple-100 transition-colors"
          >
            <CalendarClock className="w-4 h-4" />
            <span>Schedule Calendar</span>
          </Link>
          <Link
            href={`/admin/staff-blogs/new?destination=${destination}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-white shadow-xs transition-opacity"
            style={{ background: "#b45309" }}
          >
            <Plus className="w-4 h-4" />
            <span>{destination === "college" ? "Write college blog" : "Write website blog"}</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-card shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Total Blogs</span>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-black text-foreground mt-2">{totalPosts}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">All your blog posts</p>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Published</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-2">{publishedPosts}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Live on website</p>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Drafts</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-700 mt-2">{draftPosts}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Pending review</p>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Live Blogs</span>
            <Radio className="w-4 h-4 text-red-600 animate-pulse" />
          </div>
          <p className="text-2xl font-black text-red-700 mt-2">{livePosts}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Real-time tickers</p>
        </div>
      </div>

      <BlogDestinationTabs basePath="/admin/staff-blogs" selected={destination} />

      <BlogCmsFilters filters={filters} categories={Array.from(new Set(allPosts.map(post => post.category)))} basePath={sectionPath} count={matching.length} page={page} pages={pages} />

      <BlogAnalyticsCards stats={analytics} />

      {/* Permission Badges */}
      {!isSuperAdmin && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-muted-foreground">Your permissions:</span>
          {canPublish && (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              ✓ Can Publish
            </span>
          )}
          {!canPublish && (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
              Draft Only (no publish)
            </span>
          )}
          {canDelete && (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">
              ✓ Can Delete Own Posts
            </span>
          )}
        </div>
      )}

      {/* Blog Table */}
      {matching.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center bg-muted/40">
            <FileText className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="font-bold text-sm text-foreground">No blog posts yet</h3>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            You haven&apos;t written any articles yet. Start writing your first blog post now.
          </p>
          <Link
            href={`/admin/staff-blogs/new?destination=${destination}`}
            className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-lg text-xs font-bold text-white"
            style={{ background: "#b45309" }}
          >
            <Plus className="w-3.5 h-3.5" />
            Write First Article
          </Link>
        </div>
      ) : (
        <div className="bg-card border rounded-2xl overflow-hidden shadow-xs">
        <BlogMobileList posts={posts} stats={analytics.perPost} hrefs={publicHrefs} staff isSuperAdmin={isSuperAdmin} canPublish={canPublish} canDelete={canDelete} />
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-4">Title &amp; Slug</th>
                  <th className="p-4">Category</th>
                  {isSuperAdmin && <th className="p-4">Author</th>}
                  <th className="p-4">Status</th>
                  <th className="p-4">Views</th>
                  <th className="p-4">Unique visitors</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-foreground">
                {posts.map((post) => (
                  <tr key={post.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 max-w-sm">
                      <div className="font-bold text-sm text-foreground line-clamp-1">
                        {post.title}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">{post.showOnWebsiteBlog ? "Website blog" : "College blog"}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {publicHrefs.get(post.id) || post.slug}
                        </span>
                        {post.isLiveBlog && (
                          <span className="text-[10px] font-extrabold text-red-600 flex items-center gap-0.5">
                            <Radio className="w-3 h-3 animate-pulse" /> LIVE
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold text-[10px]">
                        {post.category.replace(/_/g, " ")}
                      </span>
                    </td>
                    {isSuperAdmin && <td className="p-4">{staffDisplayName(post.author)}</td>}
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          STATUS_STYLES[post.status] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {post.status}
                      </span>
                    </td>
                    <td className="p-4 font-semibold">{(analytics.perPost[post.id]?.views || 0).toLocaleString("en-IN")}</td>
                    <td className="p-4">{(analytics.perPost[post.id]?.visitors || 0).toLocaleString("en-IN")}</td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(post.publishedAt || post.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {post.status === "PUBLISHED" && (
                          <Link
                            href={publicHrefs.get(post.id) || `/blog/${post.slug}`}
                            target="_blank"
                            className="p-1.5 rounded-lg border hover:bg-accent text-muted-foreground"
                            title="View Live"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                        )}
                        <Link
                          href={`/admin/staff-blogs/${post.id}/edit`}
                          className="px-2.5 py-1.5 rounded-lg border bg-background hover:bg-accent text-foreground font-semibold flex items-center gap-1"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </Link>
<Link href={`/admin/blogs/${post.id}/engagement`} className="rounded-lg border px-2 py-1.5 text-xs font-semibold">Likes &amp; comments</Link>
                        <StaffBlogActions
                          postId={post.id}
                          status={post.status}
                          canPublish={canPublish}
                          canDelete={canDelete}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

