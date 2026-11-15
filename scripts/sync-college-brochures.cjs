const { loadEnvConfig } = require('@next/env');
const { PrismaClient } = require('@prisma/client');
const catalog = require('../src/data/college-brochures.json');
loadEnvConfig(process.cwd());
const db = new PrismaClient();
async function main() {
  await db.$transaction(Object.entries(catalog).map(([slug, documents]) =>
    db.college.updateMany({ where: { slug }, data: { brochurePdfUrl: documents.find(item => item.year === '2026-27')?.url || null } })
  ));
  console.log('Replaced placeholder brochure URLs with verified official documents.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
