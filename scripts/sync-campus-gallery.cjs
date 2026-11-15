const { loadEnvConfig } = require('@next/env');
const { PrismaClient } = require('@prisma/client');
const catalog = require('../src/data/campus-photos.json');

loadEnvConfig(process.cwd());
const db = new PrismaClient();

async function main() {
  await db.$transaction(Object.entries(catalog).map(([slug, photos]) =>
    db.college.updateMany({ where: { slug }, data: { galleryUrls: photos.map(photo => photo.src) } })
  ));
  console.log('Updated campus galleries without changing other college data.');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
