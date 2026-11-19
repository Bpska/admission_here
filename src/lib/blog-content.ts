/** Preserve existing editorial blocks while moving between Markdown and rich text. */
export function normalizeBlogBlocks(content: string) {
  return content.replace(/<div\b([^>]*\bdata-blog-block=["'](?:college|tldr|live)["'][^>]*)>[\s\S]*?<\/div>/gi, (_block, attributes: string) => {
    const type = attributes.match(/data-blog-block=["']([^"']+)["']/)?.[1];
    const slug = attributes.match(/data-college-slug=["']([a-z0-9-]+)["']/)?.[1];
    if (type === "college" && slug) return `\n\n<EmbeddedCollegeCTA slug="${slug}" />\n\n`;
    if (type === "tldr") return "\n\n<BlogTldrBox />\n\n";
    if (type === "live") return "\n\n<LiveBlogTicker />\n\n";
    return "";
  });
}

export function blogBlocksForEditor(content: string) {
  return content
    .replace(/<EmbeddedCollegeCTA\s+slug=["']([a-z0-9-]+)["'][^>]*\/>/g, '<div data-blog-block="college" data-college-slug="$1"></div>')
    .replace(/<BlogTldrBox\s*\/>/g, '<div data-blog-block="tldr"></div>')
    .replace(/<LiveBlogTicker\s*\/>/g, '<div data-blog-block="live"></div>');
}

export function cleanBlogBody(content: string) {
  return normalizeBlogBlocks(content)
    .replace(/<BlogTldrBox\s*\/>/g, "")
    .replace(/<LiveBlogTicker\s*\/>/g, "")
    .replace(/<EmbeddedCollegeCTA[^>]*\/>/g, "");
}

export function blogCollegeSlugs(content: string) {
  return [...new Set(Array.from(normalizeBlogBlocks(content).matchAll(/<EmbeddedCollegeCTA\s+slug=["']([a-z0-9-]+)["'][^>]*\/>/g), match => match[1]))];
}

export function removeBlogCollege(content: string, slug: string) {
  return normalizeBlogBlocks(content).replace(/<EmbeddedCollegeCTA\s+slug=["']([a-z0-9-]+)["'][^>]*\/>/g, (block, value: string) => value === slug ? "" : block);
}

export function blogArticleHref(post: { slug: string; showOnWebsiteBlog: boolean }, collegeSlug?: string) {
  return !post.showOnWebsiteBlog && collegeSlug ? `/college/${collegeSlug}/blogs/${post.slug}` : `/blog/${post.slug}`;
}
