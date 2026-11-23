export const BLOG_IMAGE_PLACEHOLDER = "/images/blog-placeholder.svg";
export function safeBlogImageUrl(value?: string | null) {
  const src = value?.trim();
  if (!src) return null;
  if (
    src.startsWith("/") &&
    !src.startsWith("//") &&
    !/[\\\u0000-\u001f]/.test(src)
  )
    return src;
  try {
    const url = new URL(src);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
/** Use an inline picture for previews when the author has not selected a cover. */
export function blogPreviewImage(post: {
  featuredImageUrl?: string | null;
  contentMdx?: string | null;
}) {
  const cover = safeBlogImageUrl(post.featuredImageUrl);
  if (cover) return cover;
  const html = post.contentMdx?.match(
    /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i,
  );
  const markdown = post.contentMdx?.match(
    /!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))/,
  );
  const src =
    html?.[1] || html?.[2] || html?.[3] || markdown?.[1] || markdown?.[2];
  return safeBlogImageUrl(src?.replace(/&amp;/g, "&"));
}
