const { PrismaClient } = require('@prisma/client');
const fs = require('node:fs');
const path = require('node:path');
const db = new PrismaClient();
async function main() {
  if (!process.argv.includes('--apply')) throw new Error('Pass --apply to back up and remove college data.');
  await db.$transaction(async tx => {
    const models = ['college', 'collegeCourse', 'examCutoff', 'placementStat', 'agencyRanking', 'review', 'collegeApprovalRequest'];
    const backup = {};
    for (const model of models) backup[model] = await tx[model].findMany();
    backup.leadCollegeLinks = await tx.lead.findMany({ where: { targetCollegeId: { not: null } }, select: { id: true, targetCollegeId: true } });
    backup.blogCollegeLinks = await tx.blogPost.findMany({ where: { relatedCollegeId: { not: null } }, select: { id: true, relatedCollegeId: true } });
    const directory = path.resolve('.local-backups');
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const file = path.join(directory, `college-data-${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify(backup, (_, value) => typeof value === 'bigint' ? { $bigint: value.toString() } : value, 2), { mode: 0o600 });
    console.log('Backup saved:', file);
    // Leads and articles remain; only their references to deleted colleges are cleared.
    await tx.lead.updateMany({ where: { targetCollegeId: { not: null } }, data: { targetCollegeId: null } });
    await tx.blogPost.updateMany({ where: { relatedCollegeId: { not: null } }, data: { relatedCollegeId: null } });
    const result = await tx.college.deleteMany();
    console.log('Colleges removed:', result.count);
    console.log('Remaining colleges:', await tx.college.count());
    console.log('Remaining course offerings:', await tx.collegeCourse.count());
    console.log('Preserved:', JSON.stringify({ users: await tx.user.count(), leads: await tx.lead.count(), articles: await tx.blogPost.count(), exams: await tx.exam.count() }));
  }, { timeout: 30000, isolationLevel: 'Serializable' });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
