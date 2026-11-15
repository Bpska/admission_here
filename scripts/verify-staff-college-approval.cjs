/* Local regression: only uniquely named temporary staff/college records are changed. */
require('@next/env').loadEnvConfig(process.cwd());
const { PrismaClient } = require('@prisma/client');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const base = process.env.QA_BASE_URL || 'http://localhost:3000';

class Client {
  constructor() { this.cookies = {}; }
  async request(path, method = 'GET', body) {
    const headers = { cookie: Object.entries(this.cookies).map(([key, value]) => `${key}=${value}`).join('; ') };
    if (body !== undefined) headers['Content-Type'] = body instanceof URLSearchParams ? 'application/x-www-form-urlencoded' : 'application/json';
    const response = await fetch(base + path, {
      method, headers, redirect: 'manual',
      body: body === undefined ? undefined : body instanceof URLSearchParams ? body : JSON.stringify(body),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0], split = pair.indexOf('=');
      this.cookies[pair.slice(0, split)] = pair.slice(split + 1);
    }
    const text = await response.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, data };
  }
  async login(email, password) {
    const csrf = await this.request('/api/auth/csrf');
    await this.request('/api/auth/callback/credentials', 'POST', new URLSearchParams({
      csrfToken: csrf.data.csrfToken, email, password, callbackUrl: base + '/admin',
    }));
    return (await this.request('/api/auth/session')).data?.user;
  }
}
module.exports = { Client };

async function main() {
  const db = new PrismaClient();
  const admin = new Client(), staff = new Client();
  const marker = 'qa-staff-create-' + crypto.randomUUID().slice(0, 8);
  const password = crypto.randomBytes(18).toString('hex');
  let passed = 0;
  const ok = response => { assert.ok(response.status >= 200 && response.status < 300, JSON.stringify(response.data)); return response.data; };
  const test = async (name, fn) => { await fn(); passed++; console.log('PASS', name); };
  const proposal = { name: marker + ' College', slug: marker, city: 'Bhubaneswar', state: 'Odisha', isPublished: true, overviewHtml: '<p>Temporary staff submission</p>' };
  try {
    assert.equal((await admin.login(process.env.QA_ADMIN_EMAIL || 'superadmin@admissionhere.in', process.env.QA_ADMIN_PASSWORD || 'Password@123'))?.role, 'SUPER_ADMIN');
    const account = ok(await admin.request('/api/v1/admin/staff', 'POST', {
      name: marker, userId: marker + '@example.com', password, permissions: ['leads'], assignedCollegeIds: [],
    })).staff;
    assert.equal((await staff.login(account.email, password))?.role, 'STAFF');

    await test('Staff without college permission cannot open or submit the new-college form', async () => {
      assert.match((await staff.request('/admin/colleges/new')).data, /Access Denied:/);
      assert.equal((await staff.request('/api/v1/cms/colleges', 'POST', proposal)).status, 401);
    });
    await test('Admin grant takes effect in the existing staff session without assigned colleges', async () => {
      ok(await admin.request('/api/v1/admin/staff', 'PATCH', { id: account.id, permissions: ['colleges'], assignedCollegeIds: [] }));
      const html = (await staff.request('/admin/colleges/new')).data;
      assert.match(html, /Submit New College for Approval/);
      assert.match(html, /Submit for Admin Approval/);
    });
    let requestId;
    await test('Staff submission queues a pending request without creating or publishing a college', async () => {
      const response = ok(await staff.request('/api/v1/cms/colleges', 'POST', proposal));
      assert.equal(response.pendingApproval, true); requestId = response.requestId;
      const request = await db.collegeApprovalRequest.findUnique({ where: { id: requestId } });
      assert.equal(request.staffId, account.id); assert.equal(request.actionType, 'CREATE');
      assert.equal(request.status, 'PENDING'); assert.equal(request.collegeId, null);
      assert.equal(await db.college.findUnique({ where: { slug: marker } }), null);
      assert.equal((await staff.request('/api/v1/colleges/by-slug/' + marker)).status, 404);
    });
    await test('Staff sees the success message and pending college in the directory', async () => {
      const html = (await staff.request('/admin/colleges?submitted=' + requestId)).data;
      assert.match(html, /College submitted successfully/);
      assert.match(html, /My college submissions/);
      assert.match(html, /Awaiting admin approval/);
      assert.ok(html.includes(proposal.name));
      assert.match(html, /No colleges are assigned to you yet/);
      assert.equal(ok(await staff.request('/api/v1/cms/colleges')).colleges.length, 0);
    });
    await test('Admin sees the new college in the approval queue and directory review section', async () => {
      const requests = ok(await admin.request('/api/v1/admin/approvals?status=PENDING')).requests;
      assert.ok(requests.some(request => request.id === requestId));
      const html = (await admin.request('/admin/colleges')).data;
      assert.match(html, /New colleges awaiting approval/); assert.ok(html.includes(proposal.name));
    });
    await test('Staff cannot approve their own college', async () => {
      assert.equal((await staff.request('/api/v1/admin/approvals', 'PATCH', { requestId, action: 'APPROVE' })).status, 403);
    });
    await test('Admin approval creates the public college and assigns it to the submitting staff', async () => {
      ok(await admin.request('/api/v1/admin/approvals', 'PATCH', { requestId, action: 'APPROVE' }));
      const college = await db.college.findUnique({ where: { slug: marker } });
      assert.ok(college?.isPublished);
      const request = await db.collegeApprovalRequest.findUnique({ where: { id: requestId } });
      assert.equal(request.status, 'APPROVED'); assert.equal(request.collegeId, college.id);
      const permission = await db.staffPermission.findUnique({ where: { userId: account.id } });
      assert.ok(permission.assignedCollegeIds.includes(college.id));
      assert.ok(ok(await staff.request('/api/v1/cms/colleges')).colleges.some(row => row.id === college.id));
      assert.equal((await staff.request('/api/v1/colleges/by-slug/' + marker)).status, 200);
    });
    await test('Approved submission remains visible to staff and cannot be approved twice', async () => {
      const html = (await staff.request('/admin/colleges')).data;
      assert.match(html, /Approved/); assert.ok(html.includes(proposal.name));
      assert.equal((await admin.request('/api/v1/admin/approvals', 'PATCH', { requestId, action: 'APPROVE' })).status, 409);
    });
    await test('Admin rejection keeps a college unpublished and exposes feedback to staff', async () => {
      const next = ok(await staff.request('/api/v1/cms/colleges', 'POST', { ...proposal, slug: marker + '-rejected', name: marker + ' Rejected' }));
      ok(await admin.request('/api/v1/admin/approvals', 'PATCH', { requestId: next.requestId, action: 'REJECT', adminFeedback: 'Please verify the college address.' }));
      assert.equal(await db.college.findUnique({ where: { slug: marker + '-rejected' } }), null);
      const html = (await staff.request('/admin/colleges')).data;
      assert.match(html, /Rejected/); assert.match(html, /Please verify the college address/);
    });
    await test('Permission revocation blocks the form and new submissions in the current session', async () => {
      ok(await admin.request('/api/v1/admin/staff', 'PATCH', { id: account.id, permissions: [] }));
      assert.match((await staff.request('/admin/colleges/new')).data, /Access Denied:/);
      assert.equal((await staff.request('/api/v1/cms/colleges', 'POST', { ...proposal, slug: marker + '-blocked' })).status, 401);
    });
    console.log(`${passed} staff college approval checks passed.`);
  } finally {
    try {
      await db.college.deleteMany({ where: { slug: { startsWith: marker } } });
      await db.user.deleteMany({ where: { email: marker + '@example.com' } });
      console.log('Removed isolated staff college approval fixtures.');
    } finally { await db.$disconnect(); }
  }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
