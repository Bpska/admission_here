export type BlogCmsFilters = { destination?: string; q?: string; status?: string; category?: string; sort?: string; page?: string };
export function filterBlogArticles<T extends { title: string; slug: string; category: string; status: string; showOnWebsiteBlog: boolean; createdAt: Date; updatedAt: Date; author: { name: string } }>(articles: T[], filters: BlogCmsFilters) {
  const query = (filters.q || "").trim().toLowerCase();
  const matching = articles.filter(post =>
    (filters.destination !== "college" || !post.showOnWebsiteBlog) &&
    (filters.destination !== "website" || post.showOnWebsiteBlog) &&
    (!filters.status || post.status === filters.status) &&
    (!filters.category || post.category === filters.category) &&
    (!query || `${post.title} ${post.slug} ${post.author.name}`.toLowerCase().includes(query))
  ).sort((a, b) => filters.sort === "title" ? a.title.localeCompare(b.title) : filters.sort === "oldest" ? a.createdAt.getTime() - b.createdAt.getTime() : b.updatedAt.getTime() - a.updatedAt.getTime());
  const pages = Math.max(1, Math.ceil(matching.length / 15));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(filters.page)) || 1));
  return { matching, posts: matching.slice((page - 1) * 15, page * 15), page, pages };
}
