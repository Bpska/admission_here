const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://admissionshub.in";

export interface CollegeJsonLdParams {
  name: string;
  slug: string;
  city: string;
  state: string;
  pincode?: string | null;
  fullAddress?: string | null;
  websiteUrl?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  overviewText: string;
  ratingOverall?: number;
  reviewCount?: number;
  establishedYear?: number | null;
}

export function generateCollegeJsonLd(params: CollegeJsonLdParams) {
  return {
    "@context": "https://schema.org",
    "@type": "CollegeOrUniversity",
    name: params.name,
    url: `${BASE_URL}/college/${params.slug}`,
    sameAs: params.websiteUrl || undefined,
    telephone: params.contactPhone || undefined,
    email: params.contactEmail || undefined,
    logo: params.logoUrl || `${BASE_URL}/images/default-college-logo.png`,
    image: params.coverImageUrl || `${BASE_URL}/images/default-campus.jpg`,
    description: params.overviewText.replace(/<[^>]+>/g, "").slice(0, 300),
    address: {
      "@type": "PostalAddress",
      streetAddress: params.fullAddress || undefined,
      addressLocality: params.city,
      addressRegion: params.state,
      postalCode: params.pincode || undefined,
      addressCountry: "IN",
    },
    ...(params.ratingOverall && params.reviewCount
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: params.ratingOverall.toFixed(1),
            reviewCount: params.reviewCount,
            bestRating: "5",
            worstRating: "1",
          },
        }
      : {}),
    ...(params.establishedYear ? { foundingDate: params.establishedYear.toString() } : {}),
  };
}

export interface CourseJsonLdParams {
  courseName: string;
  degree: string;
  collegeName: string;
  totalFeesInr: number | null;
  durationYrs: number | null;
  slug: string;
}

export function generateCourseJsonLd(params: CourseJsonLdParams) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: `${params.degree} in ${params.courseName}`,
    description: `${params.degree} program offered at ${params.collegeName} ${params.durationYrs ? `with a duration of ${params.durationYrs} years` : ""}.`,
    provider: {
      "@type": "CollegeOrUniversity",
      name: params.collegeName,
    },
    ...(params.totalFeesInr == null ? {} : { offers: {
      "@type": "Offer",
      price: params.totalFeesInr,
      priceCurrency: "INR",
      category: "Tuition",
    } }),
    ...(params.durationYrs ? { timeRequired: `P${params.durationYrs}Y` } : {}),
  };
}

export interface NewsArticleJsonLdParams {
  canonicalPath?: string;
  title: string;
  slug: string;
  metaDescription?: string | null;
  featuredImageUrl?: string | null;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  authorName: string;
  authorDesignation?: string | null;
  articleType?: "NewsArticle" | "BlogPosting";
  wordCount?: number;
  readingMinutes?: number;
  category?: string;
  tags?: string[];
}

export function generateNewsArticleJsonLd(params: NewsArticleJsonLdParams) {
  return {
    "@context": "https://schema.org",
    "@type": params.articleType || "NewsArticle",
    headline: params.title,
    description: params.metaDescription || params.title,
    ...(params.featuredImageUrl ? { image: [new URL(params.featuredImageUrl, BASE_URL).href] } : {}),
    ...(params.wordCount !== undefined ? { wordCount: params.wordCount } : {}),
    ...(params.readingMinutes ? { timeRequired: `PT${params.readingMinutes}M` } : {}),
    ...(params.category ? { articleSection: params.category } : {}),
    ...(params.tags?.length ? { keywords: params.tags.join(", ") } : {}),
    datePublished: params.publishedAt ? new Date(params.publishedAt).toISOString() : new Date().toISOString(),
    dateModified: params.updatedAt ? new Date(params.updatedAt).toISOString() : new Date().toISOString(),
    author: {
      "@type": "Person",
      name: params.authorName,
      ...(params.authorDesignation ? { jobTitle: params.authorDesignation } : {}),
    },
    publisher: {
      "@type": "Organization",
      name: "Admission Here Editorial Desk",
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${BASE_URL}${params.canonicalPath || `/blog/${params.slug}`}`,
    },
  };
}

export function generateFaqJsonLd(faqs: Array<{ question: string; answer: string }>) {
  if (!faqs || faqs.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };
}

export function generateBreadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${BASE_URL}${item.url}`,
    })),
  };
}

