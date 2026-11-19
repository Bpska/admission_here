import { programKey, collegeProgramHref } from "./college-programs";
import { Prisma } from "@prisma/client";
import { db } from "./db";
export type SearchSuggestion = { id: string; type: "college" | "blog"; title: string; subtitle: string; href: string };
export async function searchSuggestions(query: string, stream?: string, client: Prisma.TransactionClient = db): Promise<SearchSuggestion[]> {
  const words = query.trim().slice(0, 100).split(/\s+/).filter(word => !/^(best|top|college|colleges|in)$/i.test(word)).slice(0, 8);
  if (query.trim().length < 2 || !words.length) return [];
  const [colleges, blogs] = await Promise.all([
    client.college.findMany({ where: { isPublished: true, ...(stream ? { courses: { some: { course: { stream: { equals: stream, mode: "insensitive" as const } } } } } : {}), AND: words.map(word => ({ OR: [{ name: { contains: word, mode: "insensitive" as const } }, { shortName: { contains: word, mode: "insensitive" as const } }, { city: { contains: word, mode: "insensitive" as const } }, { state: { contains: word, mode: "insensitive" as const } }, { courses: { some: { OR: [{ specialization: { contains: word, mode: "insensitive" as const } }, { course: { OR: [{ fullName: { contains: word, mode: "insensitive" as const } }, { stream: { contains: word, mode: "insensitive" as const } }, { degree: { contains: word, mode: "insensitive" as const } }] } }] } } }] })) }, select: { id: true, slug: true, name: true, city: true, state: true, courses: { select: { course: { select: { degree: true, stream: true } } } } }, orderBy: [{ isFeatured: "desc" }, { name: "asc" }], take: 5 }),
    stream ? Promise.resolve([]) : client.blogPost.findMany({ where: { status: "PUBLISHED", showOnWebsiteBlog: true, AND: words.map(word => ({ OR: [{ title: { contains: word, mode: "insensitive" as const } }, { metaDescription: { contains: word, mode: "insensitive" as const } }, { tags: { has: word.toLowerCase() } }] })) }, select: { id: true, slug: true, title: true, category: true }, orderBy: { publishedAt: "desc" }, take: 4 }),
  ]);
  return [...colleges.map(college => {
    const requestedDegree = query.match(/\b(mca|mba|bba|bca|mbbs|diploma)\b/i)?.[1]?.toLowerCase();
    const discipline = stream || query.match(/\b(engineering|management|medical)\b/i)?.[1];
    const choice = college.courses.find(offering => requestedDegree ? programKey(offering.course.degree) === requestedDegree : discipline ? offering.course.stream.toLowerCase() === discipline.toLowerCase() : false);
    return { id: college.id, type: "college" as const, title: `${college.name}${choice ? ` — ${choice.course.degree}` : ""}`, subtitle: `${college.city}, ${college.state}`, href: choice ? collegeProgramHref(college.slug, programKey(choice.course.degree)) : `/college/${college.slug}` };
  }), ...blogs.map(blog => ({ id: blog.id, type: "blog" as const, title: blog.title, subtitle: blog.category.replace(/_/g, " "), href: `/blog/${blog.slug}` }))];
}
