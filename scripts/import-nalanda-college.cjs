// Import a reviewed official-source profile; existing college records are never overwritten.
const { PrismaClient } = require('@prisma/client');
const fs = require('node:fs');
const path = require('node:path');
const source = require('../src/data/college-imports/nalanda.json');
const db = new PrismaClient();
async function main() {
  const directory = process.argv[2];
  if (!directory) throw Error('Usage: node --env-file=.env scripts/import-nalanda-college.cjs <downloaded-image-directory>');
  const assets = source.images.map(image => {
    const data = fs.readFileSync(path.join(directory, image.file));
    if (!data.length || data.length > 3 * 1024 * 1024) throw Error('Invalid image size: ' + image.file);
    const png = data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = data[0] === 255 && data[1] === 216 && data[2] === 255;
    if (!png && !jpeg) throw Error('Unsupported image: ' + image.file);
    return { ...image, data, mimeType: png ? 'image/png' : 'image/jpeg' };
  });
  await db.$transaction(async tx => {
    const existing = await tx.college.findUnique({ where: { slug: source.college.slug } });
    if (existing) { console.log('College already exists; no records changed:', existing.slug); return; }
    const admin = await tx.user.findFirst({ where: { role: 'SUPER_ADMIN', isActive: true }, select: { id: true } });
    const galleryUrls = [];
    let logoUrl, coverImageUrl;
    for (const asset of assets) {
      const stored = await tx.blogImage.create({ data: { data: asset.data, size: asset.data.length, mimeType: asset.mimeType, uploaderId: admin?.id } });
      const url = `/api/v1/blog-images/${stored.id}`;
      if (asset.usage === 'logo') logoUrl = url;
      else galleryUrls.push(url);
      if (asset.usage === 'cover-gallery') coverImageUrl = url;
    }
    const college = await tx.college.create({ data: { ...source.college, logoUrl, coverImageUrl, galleryUrls } });
    console.log(JSON.stringify({ id: college.id, slug: college.slug, published: college.isPublished, galleryPhotos: galleryUrls.length, programmesDocumented: source.programmes.length, currentFees: 'unverified — not populated', sourceVerifiedAt: source.verifiedAt }, null, 2));
  }, { timeout: 30000 });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
