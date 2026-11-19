import BlogsPage from "../page";
import type { BlogCmsFilters } from "@/lib/blog-cms";
export const dynamic = "force-dynamic";
export default function BlogSectionPage({ searchParams }: { searchParams: Promise<BlogCmsFilters> }) {
  return BlogsPage({ searchParams: searchParams.then(filters => ({ ...filters, destination: "website" })) });
}
