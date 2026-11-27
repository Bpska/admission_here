export type ImageField = "logoUrl" | "coverImageUrl" | "galleryUrls";

export type ImportImage = {
  field: ImageField;
  source: string;
  status: "pending" | "invalid" | "preserved" | "saved" | "failed";
  message: string;
  url?: string;
};

export const imageLabels: Record<ImageField, string> = {
  logoUrl: "Logo",
  coverImageUrl: "Cover",
  galleryUrls: "Gallery",
};

export const storedImageId = (value: string) =>
  /^\/api\/v1\/blog-images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(value)?.[1];

export function remoteImageUrl(value: string) {
  if (value.length > 4096) throw new Error("Image URL is too long.");
  const url = new URL(value);
  if (
    url.protocol !== "https:" || url.port || url.username || url.password ||
    !url.hostname.includes(".") || url.hostname.endsWith(".") ||
    /(?:^|\.)(?:localhost|local|internal|test|invalid|example|onion)$/.test(url.hostname) ||
    /^\d+(?:\.\d+){3}$/.test(url.hostname) || /^\[/.test(url.hostname)
  ) throw new Error("Use a public HTTPS hostname on the default port.");
  url.hash = "";
  return url;
}

export function planImages(
  values: Record<string, string>,
  existing?: Partial<Record<ImageField, string | string[] | null>>,
  replace = false,
): ImportImage[] {
  const images: ImportImage[] = [];
  for (const field of Object.keys(imageLabels) as ImageField[]) {
    const input = values[field]?.trim();
    if (!input) continue;
    const current = existing?.[field];
    const sources = current && current.length ? [current].flat() : [];
    const thumbnail = sources.find(storedImageId);
    let entries: string[];
    try {
      if (field !== "galleryUrls") entries = [input];
      else if (input.startsWith("[")) {
        const parsed: unknown = JSON.parse(input);
        if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "string"))
          throw new Error("Use a JSON array of URL strings.");
        entries = parsed;
      } else entries = input.split(input.includes("\n") ? /\r?\n/ : /,\s*/);
      entries = [...new Set(entries.map((url) => url.trim()).filter(Boolean))];
      if (entries.length > 10) throw new Error("Use up to 10 gallery URLs per college.");
    } catch (error) {
      images.push({ field, source: "", status: "invalid", message: (error as Error).message });
      continue;
    }
    for (const source of entries) {
      const id = storedImageId(source);
      try {
        if (!id) remoteImageUrl(source);
      } catch {
        images.push({ field, source, status: "invalid", message: "Use a public HTTPS image URL or an existing uploaded image path." });
        continue;
      }
      if (sources.length && !replace) {
        images.push({ field, source, status: "preserved", message: "Existing image retained.", url: thumbnail });
      } else {
        images.push({
          field, source, status: "pending",
          message: id ? "Stored image path. Availability checked at import." : "HTTPS URL format valid. Download checked at import.",
          url: id ? source : undefined,
        });
      }
    }
  }
  return images;
}
