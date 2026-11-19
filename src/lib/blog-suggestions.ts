import { cleanBlogBody } from "./blog-content";
const stopWords = new Set("a an and are as at be been but by can college colleges for from has have how in into is it its of on or our that the their them these they this to was we were what when where which who will with you your admission admissions read article blog more about also than then not all any each such".split(" "));
export function articlePlainText(content: string) {
  return cleanBlogBody(content).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/[#*_`]/g, "").replace(/\s+/g, " ").trim();
}
export function suggestionKeywords(text: string) {
  return text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}.-]{2,}/gu)?.map(word => word.replace(/[.-]+$/g, "")).filter(word => word.length > 2 && !stopWords.has(word) && !/^\d+$/.test(word)) || [];
}
function shorten(text: string, length: number) { if (text.length <= length) return text; const cut = text.slice(0, length + 1); const boundary = cut.lastIndexOf(" "); return cut.slice(0, boundary > length / 2 ? boundary : length).trim(); }
export function suggestBlogMetadata(title: string, content: string) {
  const plain = articlePlainText(content);
  const heading = content.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i)?.[1] || content.match(/^#{1,2}\s+(.+)$/m)?.[1] || "";
  const firstSentence = plain.match(/^.{10,180}?[.!?](?:\s|$)/)?.[0]?.trim() || shorten(plain, 80);
  const titles = [...new Set([title.trim(), articlePlainText(heading), firstSentence].filter(value => value.length >= 3).map(value => shorten(value, 100)))];
  const frequencies = new Map<string, number>();
  suggestionKeywords(`${title} ${title} ${plain}`).forEach(word => frequencies.set(word, (frequencies.get(word) || 0) + 1));
  const tags = [...frequencies].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([word]) => word);
  return { titles, metaTitle: shorten(title.trim() || titles[0] || "", 60), metaDescription: shorten(plain, 160), tags };
}
