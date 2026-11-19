"use client";

import { useRouter } from "next/navigation";
import { BlogMdxEditor } from "@/components/admin/BlogMdxEditor";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewBlogPage({canPublish, initialCollegeSlug, initialDestination}: {canPublish: boolean; initialCollegeSlug?: string; initialDestination?: "website" | "college"}) {
  const router = useRouter();

  const handleSave = async (data: any, isPublish: boolean) => {
    const res = await fetch("/api/v1/cms/blogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, publish: isPublish }),
    });

    if (res.ok) {
      router.push(`/admin/blogs/${data.showOnWebsiteBlog ? "website" : "college"}`);
    } else {
      const json = await res.json();
      throw new Error(json.error || "Failed to save article");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/blogs/${initialDestination || "website"}`}
          className="p-2 rounded-lg border hover:bg-accent text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">
            {initialDestination === "college" ? "Write a college blog" : "Write a website blog"}
          </h1>
          <p className="text-xs text-muted-foreground">
            Choose where to publish, write your article, and preview it before publishing.
          </p>
        </div>
      </div>

      <BlogMdxEditor initialDestination={initialDestination} initialCollegeSlug={initialCollegeSlug} canPublish={canPublish} onSave={handleSave} />
    </div>
  );
}
