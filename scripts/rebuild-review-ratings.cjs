require('@next/env').loadEnvConfig(process.cwd());
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const colleges = await db.college.findMany({ select: { id: true } });
  for (const college of colleges) await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${college.id}))`;
    const totals = await tx.review.aggregate({ where: { collegeId: college.id, moderationStatus: 'APPROVED' }, _count: { id: true }, _avg: { ratingOverall: true } });
    await tx.college.update({ where: { id: college.id }, data: { reviewCount: totals._count.id, ratingOverall: totals._avg.ratingOverall || 0 } });
  });
  console.log(`Rebuilt approved-review counts and average ratings for ${colleges.length} colleges.`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
