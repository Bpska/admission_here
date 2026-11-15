import campusPhotos from "@/data/campus-photos.json";

type CampusPhoto = (typeof campusPhotos)[keyof typeof campusPhotos][number];

import type { Prisma } from "@prisma/client";

export function CollegeGalleryContent({ college }: { college: Prisma.CollegeGetPayload<{}> }) {

  const slug = college.slug;


  const importedPhotos: CampusPhoto[] = (campusPhotos as Record<string, CampusPhoto[]>)[slug] || [];
  const photos = college.galleryUrls
    .map((src, index) => ({ src, credit: importedPhotos.find((photo) => photo.src === src), index }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-foreground">
          {college.name} Campus Infrastructure & Photo Gallery
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Explore photographs of {college.shortName || college.name} and its campus facilities.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {photos.map(({ src, credit, index }) => (
          <figure
            key={src}
            className="group min-w-0 rounded-2xl overflow-hidden border bg-card shadow-sm"
          >
            <a href={src} target="_blank" rel="noreferrer" className="block aspect-[4/3] overflow-hidden bg-muted">
            <img
              src={src}
              alt={credit?.title || `${college.name} campus photo ${index + 1}`}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            </a>
            <figcaption className="p-4 space-y-2 text-xs break-words">
              <p className="font-semibold">{credit?.title || `Campus photo ${index + 1}`}</p>
              {credit && <p className="text-muted-foreground">
                Photo: {credit.author}. <a href={credit.source} target="_blank" rel="noreferrer" className="underline">Wikimedia Commons</a>
                {" · "}<a href={credit.licenseUrl} target="_blank" rel="noreferrer" className="underline">{credit.license}</a>
                {" · Resized; preview cropped."}
              </p>}
            </figcaption>
          </figure>
        ))}
      </div>
      {photos.length === 0 && <p className="text-sm text-muted-foreground">Campus photos have not been added yet.</p>}
    </div>
  );
}
