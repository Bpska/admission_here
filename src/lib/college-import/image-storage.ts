import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { downloadImage } from "./image-download";
import { imageLabels, storedImageId, type ImportImage } from "./image-plan";

type Download = Awaited<ReturnType<typeof downloadImage>>;
export type ImageDownloads = Map<string, { data: Download } | { message: string }>;

export async function prepareImageDownloads(images: ImportImage[], download = downloadImage) {
  const sources = [...new Set(images.filter((image) =>
    image.status === "pending" && !storedImageId(image.source)).map((image) => image.source))];
  const signal = AbortSignal.timeout(8_000);
  const downloads: ImageDownloads = new Map();
  // Keep both network and native decoder work bounded for large galleries.
  for (let index = 0; index < sources.length; index += 2) {
    await Promise.all(sources.slice(index, index + 2).map(async (source) => {
      try {
        downloads.set(source, { data: await download(source, signal) });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "";
        const safe = /^(Image |Use a public HTTPS)/.test(detail);
        downloads.set(source, { message: safe ? detail : "Image could not be downloaded securely or within the time limit." });
      }
    }));
  }
  return downloads;
}

// Content-address imported assets via the existing UUID storage and delivery
// route. Verify the full digest on reuse, including an unexpected ID collision.
function contentIdentity(data: Uint8Array) {
  const digest = createHash("sha256").update(data).digest("hex");
  const key = createHash("sha256").update("admission-here:college-image:").update(digest).digest("hex");
  const id = `${key.slice(0, 8)}-${key.slice(8, 12)}-8${key.slice(13, 16)}-8${key.slice(17, 20)}-${key.slice(20, 32)}`;
  return { id, digest };
}

async function saveImage(
  tx: Prisma.TransactionClient,
  uploaderId: string,
  data: Download,
  { id, digest }: ReturnType<typeof contentIdentity>,
) {
  const stored = await tx.blogImage.upsert({
    where: { id }, update: {},
    create: { id, uploaderId, mimeType: "image/webp", size: data.length, data: new Uint8Array(data) },
    select: { data: true, mimeType: true },
  });
  if (stored.mimeType !== "image/webp" || createHash("sha256").update(stored.data).digest("hex") !== digest)
    throw new Error("Imported image storage hash mismatch.");
  return `/api/v1/blog-images/${id}`;
}

export async function applyImportedImages(
  tx: Prisma.TransactionClient,
  collegeId: string,
  actorId: string,
  images: ImportImage[],
  downloads: ImageDownloads,
) {
  const results: ImportImage[] = [];
  const data: Prisma.CollegeUpdateInput = {};
  const stored = new Map<string, string>();
  for (const field of Object.keys(imageLabels) as ImportImage["field"][]) {
    const entries = images.filter((image) => image.field === field);
    const resolved = await Promise.all(entries.map(async (image) => {
      if (image.status !== "pending") return { image };
      const id = storedImageId(image.source);
      if (id && await tx.blogImage.findUnique({ where: { id }, select: { id: true } }))
        return { image, url: image.source };
      const download = downloads.get(image.source);
      if (download && "data" in download) return { image, bytes: download.data };
      const message = id ? "Stored image was not found." : download?.message || "Image was unavailable during this batch.";
      return { image: { ...image, status: "failed" as const, message, url: undefined } };
    }));
    // Keep the full current gallery if any requested replacement cannot be read.
    const incompleteGallery = field === "galleryUrls" &&
      resolved.some(({ image }) => ["failed", "invalid"].includes(image.status)) &&
      (await tx.college.findUniqueOrThrow({ where: { id: collegeId }, select: { galleryUrls: true } })).galleryUrls.length > 0;
    const urls: string[] = [];
    for (const { image, url, bytes } of resolved) {
      if (!url && !bytes) {
        results.push(image);
        continue;
      }
      if (incompleteGallery) {
        results.push({ ...image, status: "preserved", message: "Existing gallery retained because a replacement failed.", url: undefined });
        continue;
      }
      let savedUrl = url;
      if (bytes) {
        const identity = contentIdentity(bytes);
        savedUrl = stored.get(identity.digest) ?? await saveImage(tx, actorId, bytes, identity);
        stored.set(identity.digest, savedUrl);
      }
      if (!savedUrl) continue;
      urls.push(savedUrl);
      results.push({ ...image, status: "saved", message: "Stored image linked to college.", url: savedUrl });
    }
    if (urls.length) {
      if (field === "galleryUrls") data.galleryUrls = [...new Set(urls)];
      else data[field] = urls[0];
    }
  }
  if (Object.keys(data).length)
    await tx.college.update({ where: { id: collegeId }, data });
  return results;
}
