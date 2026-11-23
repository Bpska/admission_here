import Link from "next/link";
import { BlogCoverImage } from "./BlogCoverImage";
export function RelatedBlogArticles({
  articles,
}: {
  articles: {
    id: string;
    title: string;
    description: string | null;
    href: string;
    category: string;
    imageUrl?: string | null;
  }[];
}) {
  if (!articles.length) return null;
  return (
    <section
      aria-labelledby="related-articles-heading"
      className="space-y-4 border-t pt-6"
    >
      <h2 id="related-articles-heading" className="text-xl font-bold">
        Explore more articles
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <article
            key={article.id}
            className="min-w-0 overflow-hidden rounded-xl border bg-card"
          >
            <Link
              href={article.href}
              className="block"
              aria-label={`Read ${article.title}`}
            >
              <BlogCoverImage src={article.imageUrl} alt={article.title} />
            </Link>
            <div className="space-y-2 p-4">
              <p className="text-xs font-semibold text-primary">
                {article.category}
              </p>
              <h3 className="break-words text-sm font-bold">
                <Link href={article.href} className="hover:text-primary">
                  {article.title}
                </Link>
              </h3>
              {article.description && (
                <p className="line-clamp-3 text-xs text-muted-foreground">
                  {article.description}
                </p>
              )}
              <Link
                href={article.href}
                className="inline-block py-2 text-xs font-semibold text-primary"
              >
                Read article →
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
