"use client";

import { useRouter } from "next/navigation";
import { BlogMdxEditor } from "@/components/admin/BlogMdxEditor";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Props {
  post: {
    likesEnabled: boolean;
    commentsEnabled: boolean;
    status: string;
    faqsJson: { question: string; answer: string }[];
    id: string;
    title: string;
    metaTitle?: string;
    metaDescription?: string;
    featuredImageUrl?: string;
    tldrSummary: string[];
    contentMdx: string;
    relatedCollegeSlug?: string;
    category: string;
    tags: string[];
    showOnWebsiteBlog: boolean;
    isLiveBlog: boolean;
    liveUpdatesJson?: { id: string; timestamp: string; headline: string; bodyHtml: string; isPinned: boolean }[];
  };
  canPublish: boolean;
}

export function StaffEditBlogClient({ post, canPublish }: Props) {
  const router = useRouter();

  const handleSave = async (data: any, isPublish: boolean) => {
    const res = await fetch("/api/v1/cms/blogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, id: post.id, publish: isPublish }),
    });

    const json = await res.json();

    if (res.ok) {
      if (json.message?.includes("Draft saved") && isPublish) {
        alert(json.message);
      }
      router.push(`/admin/staff-blogs/${data.showOnWebsiteBlog ? "website" : "college"}`);
    } else {
      throw new Error(json.error || "Failed to update article");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/staff-blogs/${post.showOnWebsiteBlog ? "website" : "college"}`}
          className="p-2 rounded-lg border hover:bg-accent text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Edit Blog Article</h1>
          <p className="text-xs text-muted-foreground">
            Edit your blog post. Changes are saved immediately on submit.
          </p>
        </div>
      </div>

      <BlogMdxEditor
        initialData={{
          id: post.id,
          status: post.status,
        likesEnabled: post.likesEnabled,
        commentsEnabled: post.commentsEnabled,
          faqsJson: post.faqsJson,
          showOnWebsiteBlog: post.showOnWebsiteBlog,
          title: post.title,
          metaTitle: post.metaTitle,
          metaDescription: post.metaDescription,
          featuredImageUrl: post.featuredImageUrl,
          tldrSummary: post.tldrSummary,
          contentMdx: post.contentMdx,
          relatedCollegeSlug: post.relatedCollegeSlug,
          category: post.category,
          tags: post.tags,
          isLiveBlog: post.isLiveBlog,
        liveUpdatesJson: post.liveUpdatesJson || [],
        }}
        canPublish={canPublish}
        onSave={handleSave}
      />
    </div>
  );
}

