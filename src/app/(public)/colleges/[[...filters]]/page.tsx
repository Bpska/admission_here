import { programKey } from "@/lib/college-programs";
import { db } from "@/lib/db";
import { CollegeCard } from "@/components/public/CollegeCard";
import { FacetedFilterSidebar } from "@/components/public/FacetedFilterSidebar";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { constructSeoMetadata } from "@/lib/seo/metadata";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { generateBreadcrumbJsonLd } from "@/lib/seo/json-ld";
import { Building2 } from "lucide-react";
import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { findNavbarFilter } from "@/lib/custom-navbar-filters";
import { NAVBAR_FILTERS, defaultNavbarFilter } from "@/lib/navbar-filters";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

interface CollegesPageProps {
  params: Promise<{ filters?: string[] }>;
  searchParams: Promise<{
    q?: string;
    stream?: string;
    course?: string;
    level?: string;
    state?: string;
    ownership?: string;
    maxFees?: string;
    page?: string;
    navFilter?: string;
  }>;
}

export async function generateMetadata({ params, searchParams }: CollegesPageProps) {
  const { filters = [] } = await params;
  const sParams = await searchParams;
  const query = sParams.q?.trim() || "";
  const selectedFilter = await findNavbarFilter(sParams.navFilter);

  let title = "Top Colleges in India 2026";
  let description =
    "Explore, compare and filter verified Indian colleges by NIRF rankings, cutoffs, tuition fees, and placements.";

  if (query) {
    title = `Search results for ${query}`;
    description = `Find colleges matching ${query}, with fees, rankings, and placement records.`;
  } else if (filters.length > 0) {
    const filterText = filters.join(" ").replace(/-/g, " ");
    title = `Top ${filterText.toUpperCase()} Colleges in India`;
    description = `Find the best ${filterText} colleges in India with verified cutoff ranks, total fees, and official NIRF rankings.`;
  } else if (sParams.stream || sParams.state) {
    const parts = [sParams.stream, sParams.state ? `in ${sParams.state}` : ""].filter(Boolean);
    title = `Top ${parts.join(" ")} Colleges`;
  }

  return constructSeoMetadata({
    title: selectedFilter?.label || title,
    description: selectedFilter?.custom ? `Explore ${selectedFilter.label}: compare available colleges, courses, fees and admission information.` : description,
    canonicalPath: selectedFilter?.custom ? selectedFilter.href : `/colleges/${filters.join("/")}${selectedFilter ? `?navFilter=${encodeURIComponent(selectedFilter.id)}` : ""}`,
  });
}

export default async function CollegesDirectoryPage({
  params,
  searchParams,
}: CollegesPageProps) {
  const { filters = [] } = await params;
  const sParams = await searchParams;
  const selectedFilter = await findNavbarFilter(sParams.navFilter);
  const filterUrl = selectedFilter ? new URL(selectedFilter.href, "https://local.invalid") : null;
  const query = sParams.q?.trim() || filterUrl?.searchParams.get("q") || "";
  if (sParams.navFilter && !selectedFilter) notFound();

  // If a single slug parameter is passed, check if it matches a college profile directly (e.g. /colleges/nit-rourkela)
  if (filters.length === 1) {
    const slugQuery = filters[0].toLowerCase();
    const collegeMatch = await db.college.findUnique({
      where: { slug: slugQuery },
      select: { slug: true },
    });
    if (collegeMatch) {
      redirect(`/college/${collegeMatch.slug}`);
    }
  }

  // Determine stream and state from URL path segments or query parameters
  let targetStream = sParams.stream || sParams.course || "";
  let targetState = sParams.state || "";
  let targetLevel = sParams.level || "";

  if (filters.length === 1) {
    targetStream = filters[0];
  } else if (filters.length >= 2) {
    targetStream = filters[0];
    targetState = filters[1].replace(/-/g, " ");
  }

  if (filters.length === 0 && filterUrl && !selectedFilter?.custom) {
    const baseFilters = filterUrl.pathname.split("/").slice(2);
    targetStream = sParams.stream || sParams.course || baseFilters[0] || "";
    targetState = sParams.state || baseFilters[1]?.replace(/-/g, " ") || filterUrl.searchParams.get("state") || "";
  }

  // A programme named in a search should open that programme's college profile.
  if (!targetStream) {
    const degree = query.match(/\b(mca|mba|bba|bca|mbbs|diploma)\b/i)?.[1];
    const discipline = query.match(/\b(engineering|management|medical)\b/i)?.[1];
    targetStream = degree || discipline || "";
  }

  // Build Prisma Where Clause
  const whereClause: Prisma.CollegeWhereInput = {
    isPublished: true,
  };

  if (query) {
    whereClause.AND = query.split(/\s+/).filter(term => !/^(best|top|college|colleges|in)$/i.test(term)).map((term) => ({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { shortName: { contains: term, mode: "insensitive" } },
        { city: { contains: term, mode: "insensitive" } },
        { state: { contains: term, mode: "insensitive" } },
        { courses: { some: { OR: [
          { specialization: { contains: term, mode: "insensitive" } },
          { course: { OR: [
            { fullName: { contains: term, mode: "insensitive" } },
            { stream: { contains: term, mode: "insensitive" } },
            { degree: { contains: term, mode: "insensitive" } },
            { slug: { contains: term, mode: "insensitive" } },
          ] } },
        ] } } },
      ],
    }));
  }

  if (targetState) {
    whereClause.state = { contains: targetState, mode: "insensitive" };
  }

  if (sParams.ownership) {
    whereClause.ownershipType = sParams.ownership as any;
  }

  if (targetStream || targetLevel) {
    const streamName = ({ "b-tech": "B.Tech", mba: "MBA", mca: "MCA", bba: "BBA", bca: "BCA", diploma: "Diploma", mbbs: "MBBS" } as Record<string, string>)[targetStream] || targetStream.replace(/-/g, " ");
    whereClause.courses = {
      some: {
        course: {
          AND: [
            targetLevel ? { level: { equals: targetLevel, mode: "insensitive" } } : {},
            targetStream
              ? {
                  OR: [
                    { stream: { contains: streamName, mode: "insensitive" } },
                    { degree: { contains: streamName, mode: "insensitive" } },
                    { slug: { contains: targetStream, mode: "insensitive" } },
                  ],
                }
              : {},
          ],
        },
      },
    };
  }

  if (selectedFilter?.specialization) {
    whereClause.courses = { some: {
      ...(whereClause.courses?.some || {}),
      specialization: { contains: selectedFilter.specialization, mode: "insensitive" },
    } };
  }

  if (sParams.maxFees) {
    const maxFee = parseInt(sParams.maxFees, 10);
    whereClause.courses = {
      ...(whereClause.courses || {}),
      some: {
        ...(whereClause.courses?.some || {}),
        totalFeesInr: { lte: maxFee },
      },
    };
  }

  let directoryWhere = whereClause;
  if (selectedFilter) {
    const intrinsicQuery = new URL(selectedFilter.href, "https://local.invalid").searchParams.get("q") || "";
    const legacySections = ["featured", "column_1", "column_2", "column_3"].filter(section => defaultNavbarFilter(selectedFilter.category, section)?.id === selectedFilter.id);
    const assigned: Prisma.CollegeWhereInput = {
      isPublished: true,
      showInNavbar: true,
      OR: [
        { navbarFilter: selectedFilter.id },
        { navbarFilter: null, navbarCategory: selectedFilter.category, navbarSection: { in: legacySections } },
      ],
      ...(targetState ? { state: whereClause.state } : {}),
      ...(sParams.ownership ? { ownershipType: whereClause.ownershipType } : {}),
      ...(query && query !== intrinsicQuery ? { AND: whereClause.AND } : {}),
      ...(sParams.maxFees || sParams.level ? { courses: { some: {
        ...(sParams.maxFees ? { totalFeesInr: { lte: parseInt(sParams.maxFees, 10) } } : {}),
        ...(sParams.level ? { course: { level: { equals: sParams.level, mode: "insensitive" } } } : {}),
      } } } : {}),
    };
    directoryWhere = selectedFilter.custom ? { AND: [whereClause, { showInNavbar: true, navbarFilter: selectedFilter.id }] } : { isPublished: true, OR: [whereClause, assigned] };
  }

  if (targetStream && /^(engineering|management|medical|computer applications|computer-applications|mca|mba|bba|bca|diploma|b-tech|mbbs)$/i.test(targetStream)) {
    directoryWhere = { AND: [directoryWhere, { courses: whereClause.courses }] };
  }

  const colleges = await db.college.findMany({
    where: directoryWhere,
    orderBy: [{ nirfRank: "asc" }, { ratingOverall: "desc" }],
    include: {
      courses: {
        where: whereClause.courses?.some,
        include: { course: true },
        orderBy: { totalFeesInr: "asc" },
        take: 1,
      },
      placements: {
        take: 1,
        orderBy: { batchYear: "desc" },
      },
    },
    take: 24,
  });

  const breadcrumbs = [
    { label: "Colleges", href: "/colleges" },
    ...(selectedFilter?.custom ? [{ label: selectedFilter.label, href: selectedFilter.href }] : []),
    ...(targetStream ? [{ label: targetStream, href: `/colleges/${targetStream}` }] : []),
    ...(targetState ? [{ label: targetState }] : []),
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <JsonLdScript
        data={generateBreadcrumbJsonLd(
          breadcrumbs.map((b) => ({ name: b.label, url: b.href || "/colleges" }))
        )}
      />

      <Breadcrumbs items={breadcrumbs} />

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground capitalize">
          {selectedFilter && (!query || query === new URL(selectedFilter.href, "https://local.invalid").searchParams.get("q")) ? selectedFilter.label : query ? `Search results for “${query}”` : targetStream ? `Top ${targetStream} Colleges` : "Discover Top Colleges in India"}{" "}
          {targetState ? `in ${targetState}` : ""}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Showing {colleges.length} verified institutions ranked by official NIRF scores and placement records.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Faceted Sidebar */}
        <Suspense fallback={<div className="w-full lg:w-64 h-96 bg-muted/20 animate-pulse rounded-xl" />}>
          <FacetedFilterSidebar />
        </Suspense>

        {/* Results Grid */}
        <div className="flex-1 min-w-0">
          {colleges.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {colleges.map((c) => (
                <CollegeCard
                  key={c.id}
                  college={{
                    id: c.id,
                    slug: c.slug,
                    programKey: targetStream && c.courses[0] ? programKey(c.courses[0].course.degree) : undefined,
                    name: c.name,
                    shortName: c.shortName,
                    logoUrl: c.logoUrl,
                    coverImageUrl: c.coverImageUrl,
                    brochurePdfUrl: c.brochurePdfUrl,
                    city: c.city,
                    state: c.state,
                    estYear: c.estYear,
                    ownershipType: c.ownershipType,
                    naacGrade: c.naacGrade,
                    nirfRank: c.nirfRank,
                    ratingOverall: c.ratingOverall,
                    reviewCount: c.reviewCount,
                    featuredCourse: c.courses[0]
                      ? {
                          degree: c.courses[0].course.degree,
                          stream: c.courses[0].course.stream,
                          specialization: c.courses[0].specialization,
                          totalFeesInr: c.courses[0].totalFeesInr,
                        }
                      : null,
                    latestPlacement: targetStream ? null : c.placements[0] || null,
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="bg-card border rounded-2xl p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">No matching colleges found</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Try clearing some filter criteria (such as max tuition fee or state) to see more institutions.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
