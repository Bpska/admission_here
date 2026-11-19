import { notFound } from "next/navigation";
import CollegesDirectoryPage, { generateMetadata as directoryMetadata } from "../../[[...filters]]/page";
import { getCustomNavbarFilters } from "@/lib/custom-navbar-filters";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> };
async function directoryProps({ params, searchParams }: Props) {
  const { slug } = await params;
  const section = (await getCustomNavbarFilters(true)).find(row => row.href === `/colleges/sections/${slug}`);
  if (!section) notFound();
  return { params: Promise.resolve({ filters: [] as string[] }), searchParams: Promise.resolve({ ...await searchParams, navFilter: section.id }) };
}
export async function generateMetadata(props: Props) { return directoryMetadata(await directoryProps(props)); }
export default async function SectionPage(props: Props) { return CollegesDirectoryPage(await directoryProps(props)); }
