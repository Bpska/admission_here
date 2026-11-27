/* Local API regression. Deletes only uniquely named temporary test colleges. */
require('@next/env').loadEnvConfig(process.cwd());
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

async function main() {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname), 'Use a localhost test database.');
  const base = process.env.QA_BASE_URL || 'http://localhost:3100';
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Use a localhost app.');
  const db = new PrismaClient();
  const marker = 'qa-bulk-delete-' + randomUUID().slice(0, 8);
  const password = randomUUID();
  const accounts = [];
  const fixtures = [];
  const blogs = [];
  const leads = [];
  let checks = 0;
  const passed = label => { checks++; console.log('PASS ' + label); };
  async function request(cookie, path, method = 'GET', body, extraHeaders = {}) {
    const response = await fetch(base + path, {
      method, redirect: 'manual',
      headers: { cookie, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, data };
  }
  async function login(role) {
    const account = await db.user.create({ data: {
      name: marker + ' ' + role, email: marker + '-' + role.toLowerCase() + '@example.com',
      passwordHash: await bcrypt.hash(password, 10), role,
    } });
    accounts.push(account.id);
    if (role === 'STAFF') await db.staffPermission.create({ data: { userId: account.id, permissions: ['colleges'], assignedCollegeIds: [] } });
    const csrf = await fetch(base + '/api/auth/csrf');
    const cookie = csrf.headers.getSetCookie().map(value => value.split(';')[0]);
    const { csrfToken } = await csrf.json();
    const logged = await fetch(base + '/api/auth/callback/credentials', {
      method: 'POST', redirect: 'manual',
      headers: { cookie: cookie.join('; '), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken, email: account.email, password, callbackUrl: base + '/admin' }),
    });
    cookie.push(...logged.headers.getSetCookie().map(value => value.split(';')[0]));
    const session = await request(cookie.join('; '), '/api/auth/session');
    assert.equal(session.data.user?.role, role, JSON.stringify(session.data));
    return { cookie: cookie.join('; '), id: account.id };
  }
  async function college(suffix) {
    const result = await db.college.create({ data: {
      name: marker + ' ' + suffix, slug: marker + '-' + suffix,
      city: 'Test City', state: 'Odisha', ownershipType: 'AIDED',
      overviewHtml: '<p>Temporary bulk deletion fixture</p>', isPublished: false,
    } });
    fixtures.push(result.id);
    return result;
  }
  const endpoint = '/api/v1/cms/colleges';
  try {
    const admin = await login('SUPER_ADMIN');
    const staff = await login('STAFF');
    const student = await login('STUDENT');
    const first = await college('first'), second = await college('second'), keep = await college('keep');
    const body = { ids: [first.id, second.id], confirm: true };
    assert.equal((await request('', endpoint, 'DELETE', body)).status, 401);
    assert.equal((await request(staff.cookie, endpoint, 'DELETE', body)).status, 403);
    assert.equal((await request(student.cookie, endpoint, 'DELETE', body)).status, 401);
    assert.equal((await request(admin.cookie, endpoint, 'DELETE', body, { origin: 'https://untrusted.example', 'sec-fetch-site': 'cross-site' })).status, 403);
    assert.equal(await db.college.count({ where: { id: { in: body.ids } } }), 2);
    passed('Anonymous users, students, staff and cross-site requests cannot bulk delete');

    for (const invalid of [{ ids: [] , confirm: true }, { ids: ['bad-id'], confirm: true }, { ids: [first.id] }, { ids: [first.id], confirm: false }, { ids: [first.id, first.id], confirm: true }, { ids: [first.id], confirm: true, all: true }]) {
      assert.equal((await request(admin.cookie, endpoint, 'DELETE', invalid)).status, 400, JSON.stringify(invalid));
    }
    assert.equal(await db.college.count({ where: { id: { in: body.ids } } }), 2);
    passed('Empty/invalid/duplicate selections and missing confirmation are rejected without deletions');

    const stale = await request(admin.cookie, endpoint, 'DELETE', { ids: [first.id, randomUUID()], confirm: true });
    assert.equal(stale.status, 409);
    assert.ok(await db.college.findUnique({ where: { id: first.id } }));
    passed('Stale selections reject the complete action without partially deleting valid colleges');

    const lead = await db.lead.create({ data: { studentName: marker, phone: '0000000000', targetStream: 'Test', targetCollegeId: first.id, sourceUrl: '/qa-bulk-delete', ctaType: 'APPLY_NOW' } });
    leads.push(lead.id);
    const blog = await db.blogPost.create({ data: { title: marker, slug: marker, contentMdx: 'Temporary test article', authorId: admin.id, category: 'COLLEGE_ROUNDUP', relatedCollegeId: first.id, status: 'DRAFT' } });
    blogs.push(blog.id);
    await db.placementStat.create({ data: { collegeId: first.id, batchYear: 2026, topRecruiters: [] } });
    await db.agencyRanking.create({ data: { collegeId: second.id, agencyName: marker, category: 'Test', rankingYear: 2026, rankNumber: 1 } });
    const result = await request(admin.cookie, endpoint, 'DELETE', body);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.deletedCount, 2);
    assert.equal(await db.college.count({ where: { id: { in: body.ids } } }), 0);
    assert.ok(await db.college.findUnique({ where: { id: keep.id } }));
    assert.equal(await db.placementStat.count({ where: { collegeId: first.id } }), 0);
    assert.equal(await db.agencyRanking.count({ where: { collegeId: second.id } }), 0);
    assert.equal((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).targetCollegeId, null);
    assert.equal((await db.blogPost.findUniqueOrThrow({ where: { id: blog.id } })).relatedCollegeId, null);
    passed('One bulk action deletes only selected colleges and their statistics, retaining student leads and blog articles');
    assert.equal((await request(admin.cookie, endpoint, 'DELETE', body)).status, 409);
    assert.ok(await db.college.findUnique({ where: { id: keep.id } }));
    passed('Repeated deletion cannot remove unrelated colleges');

    const adminPage = await request(admin.cookie, '/admin/colleges');
    assert.equal(adminPage.status, 200);
    assert.ok(adminPage.data.includes('Select all colleges'));
    assert.ok(adminPage.data.includes('Delete selected'));
    const staffPage = await request(staff.cookie, '/admin/colleges');
    assert.equal(staffPage.status, 200);
    assert.ok(!staffPage.data.includes('Select all colleges'));
    passed('Admin directory displays bulk controls; staff directory hides them');
    console.log(checks + ' bulk deletion checks passed.');
  } finally {
    await db.lead.deleteMany({ where: { id: { in: leads } } });
    await db.blogPost.deleteMany({ where: { id: { in: blogs } } });
    await db.college.deleteMany({ where: { id: { in: fixtures } } });
    await db.user.deleteMany({ where: { id: { in: accounts } } });
    await db.$disconnect();
    console.log('Removed temporary bulk-delete fixtures.');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
