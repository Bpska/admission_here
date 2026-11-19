import Link from "next/link";
export function RelatedBlogArticles({ articles }: { articles: { id: string; title: string; description: string | null; href: string; category: string }[] }) {
  if (!articles.length) return null;
  return <section aria-labelledby="related-articles-heading" className="space-y-4 border-t pt-6"><h2 id="related-articles-heading" className="text-xl font-bold">Suggested articles</h2><div className="grid gap-4 sm:grid-cols-3">{articles.map(article => <article key={article.id} className="space-y-2 rounded-xl border bg-card p-4"><p className="text-xs font-semibold text-primary">{article.category}</p><h3 className="text-sm font-bold"><Link href={article.href} className="hover:text-primary">{article.title}</Link></h3>{article.description && <p className="line-clamp-3 text-xs text-muted-foreground">{article.description}</p>}<Link href={article.href} className="inline-block text-xs font-semibold text-primary">Read article →</Link></article>)}</div></section>;
}
