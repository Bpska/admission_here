import { BlogMobileList } from "@/components/admin/BlogMobileList";
import { BlogCmsFilters } from "@/components/admin/BlogCmsFilters";
import { filterBlogArticles, type BlogCmsFilters as Filters } from "@/lib/blog-cms";
import { canonicalBlogHref } from "@/lib/blog-destination";
import { BlogDestinationTabs } from "@/components/admin/BlogDestinationTabs";
import { getBlogStats } from "@/lib/blog-analytics";
import { BlogAnalyticsCards } from "@/components/admin/BlogAnalyticsCards";
import Link from "next/link";
import { db } from "@/lib/db";
import { Plus, Edit, Eye, Radio, Trash2, EyeOff } from "lucide-react";
import { checkAdminAccess } from "@/lib/auth/staff-guard";
import { StaffAccessDenied } from "@/components/admin/StaffAccessDenied";
import { AdminBlogActions } from "./AdminBlogActions";

export const revalidate = 0;

const STATUS_STYLES: Record<string, string> = {
  PUBLISHED: "bg-emerald-100 text-emerald-800",
  DRAFT: "bg-amber-100 text-amber-800",
  IN_REVIEW: "bg-blue-100 text-blue-800",
  SCHEDULED: "bg-purple-100 text-purple-800",
  ARCHIVED: "bg-gray-100 text-gray-700",
};

export default async function AdminBlogsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const requestedFilters = await searchParams;
  const filters = { ...requestedFilters, destination: requestedFilters.destination === "college" ? "college" : "website" };
  const { destination } = filters;
  const sectionPath = `/admin/blogs/${destination}`;
  const access = await checkAdminAccess("blogs");
  if (!access.allowed) {
    return (
      <StaffAccessDenied
        featureName="Editorial Blog CMS"
        allowedFeatures={access.permissions}
      />
    );
  }

  const allPosts = await db.blogPost.findMany({
    where: access.isSuperAdmin ? {} : { authorId: access.userId },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { name: true } },
      _count: { select: { generatedLeads: true } },
    },
  });

  const { matching, posts, page, pages } = filterBlogArticles(allPosts, filters);
  const publicHrefs = new Map(await Promise.all(posts.map(async post => [post.id, await canonicalBlogHref(post)] as const)));


  const analytics = await getBlogStats(matching.map(post => post.id));

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {destination === "college" ? "College Blogs" : "Website Blogs"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {destination === "college" ? "Manage articles shown in individual colleges’ Blogs sections." : "Manage articles published on the website’s main Blog page."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/blogs/new?destination=${destination}`}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center gap-1.5 hover:bg-primary/90 transition-colors shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>{destination === "college" ? "Write college blog" : "Write website blog"}</span>
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Posts", value: matching.length, color: "#1a3068" },
          { label: "Published", value: matching.filter((p) => p.status === "PUBLISHED").length, color: "#1f8040" },
          { label: "Drafts", value: matching.filter((p) => p.status === "DRAFT").length, color: "#b45309" },
          { label: "Live Blogs", value: matching.filter((p) => p.isLiveBlog).length, color: "#c41e1e" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border rounded-xl p-4 shadow-xs">
            <p className="text-[11px] font-semibold text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-black mt-1" style={{ color: stat.color }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <BlogDestinationTabs basePath="/admin/blogs" selected={destination} />

      <BlogCmsFilters filters={filters} categories={Array.from(new Set(allPosts.map(post => post.category)))} basePath={sectionPath} count={matching.length} page={page} pages={pages} />

      <BlogAnalyticsCards stats={analytics} />

      <div className="bg-card border rounded-2xl overflow-hidden shadow-xs">
        <BlogMobileList posts={posts} stats={analytics.perPost} hrefs={publicHrefs} isSuperAdmin={access.isSuperAdmin} canPublish={access.isSuperAdmin || access.permissions.includes("blogs") || access.permissions.includes("blogs:publish")} />
        <div className="hidden md:block overflow-x-auto touch-scroll">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">Title &amp; Slug</th>
                <th className="p-4">Category</th>
                <th className="p-4">Author</th>
                <th className="p-4">Status</th>
                <th className="p-4">Views</th>
                <th className="p-4">Unique visitors</th>
                <th className="p-4">Leads</th>
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
                    {post.featuredImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.featuredImageUrl}
                        alt=""
                        className="mt-1.5 h-10 w-16 rounded object-cover border"
                      />
                    )}
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold text-[10px]">
                      {post.category.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="p-4">{post.author.name}</td>
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
                  <td className="p-4 font-bold text-blue-600">
                    {post._count.generatedLeads} leads
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={publicHrefs.get(post.id) || `/blog/${post.slug}`}
                        target="_blank"
                        className="p-1.5 rounded-lg border hover:bg-accent text-muted-foreground"
                        title="View Live Article"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Link>
                      <Link
                        href={`/admin/blogs/${post.id}/edit`}
                        className="px-2.5 py-1.5 rounded-lg border bg-background hover:bg-accent text-foreground font-semibold flex items-center gap-1"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </Link>
<Link href={`/admin/blogs/${post.id}/engagement`} className="rounded-lg border px-2 py-1.5 text-xs font-semibold">Likes &amp; comments</Link>
                      {/* Client-side delete/unpublish actions */}
                      <AdminBlogActions
                        postId={post.id}
                        status={post.status}
                        isSuperAdmin={access.isSuperAdmin}
                        canPublish={access.isSuperAdmin || access.permissions.includes("blogs") || access.permissions.includes("blogs:publish")}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
