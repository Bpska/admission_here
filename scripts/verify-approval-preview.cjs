/* Isolated local regression for private website previews and pre-approval admin editing. */
require('@next/env').loadEnvConfig(process.cwd());
const { PrismaClient } = require('@prisma/client');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Client } = require('./verify-staff-college-approval.cjs');
const db = new PrismaClient(), admin = new Client(), staff = new Client(), other = new Client(), anon = new Client();
const marker = 'qa-approval-preview-' + crypto.randomUUID().slice(0, 8);
const password = crypto.randomBytes(18).toString('hex');
const ok = response => { assert.ok(response.status >= 200 && response.status < 300, JSON.stringify(response.data)); return response.data; };
let passed = 0;
const test = async (name, fn) => { await fn(); console.log('PASS', name); passed++; };
(async () => {
  assert.equal((await admin.login(process.env.QA_ADMIN_EMAIL || 'superadmin@admissionhere.in', process.env.QA_ADMIN_PASSWORD || 'Password@123'))?.role, 'SUPER_ADMIN');
  const accounts = [];
  for (const suffix of ['-staff', '-other']) accounts.push(ok(await admin.request('/api/v1/admin/staff', 'POST', { name: marker + suffix, userId: marker + suffix + '@example.com', password, permissions: ['colleges'], assignedCollegeIds: [] })).staff);
  assert.equal((await staff.login(accounts[0].email, password))?.role, 'STAFF');
  assert.equal((await other.login(accounts[1].email, password))?.role, 'STAFF');
  const data = { name: marker + ' College', slug: marker, city: 'Bhubaneswar', state: 'Odisha', isPublished: true,
    overviewHtml: '<p>Proposed campus overview</p><img src="/missing-qa-image" onerror="document.documentElement.dataset.qaUnsafe=1">',
    admissionHtml: '<p>Proposed admission instructions</p>', galleryUrls: ['/logo.png'],
    facilitiesJson: ['Test library'], faqsJson: [{ question: 'QA custom question?', answer: 'QA custom answer' }] };
  const proposal = ok(await staff.request('/api/v1/cms/colleges', 'POST', data));
  const id = proposal.requestId;
  let version = (await db.collegeApprovalRequest.findUnique({ where: { id } })).updatedAt.toISOString();
  await test('Private college preview renders all nine public tabs with the proposed college', async () => {
    for (const tab of ['', '/courses-fees', '/admission', '/cutoff', '/placements', '/rankings', '/gallery', '/reviews', '/qna']) {
      const response = await admin.request('/approval-preview/' + id + tab);
      assert.equal(response.status, 200); assert.ok(response.data.includes(data.name), tab);
      assert.ok(!response.data.includes('NEXT_HTTP_ERROR_FALLBACK;404'), tab);
      assert.ok(response.data.includes('noindex'), tab);
    }
    const overview = (await admin.request('/approval-preview/' + id)).data;
    assert.match(overview, /Key Institutional Highlights/); assert.match(overview, /Proposed campus overview/);
    assert.ok(!overview.includes('onerror='));
    assert.match((await admin.request('/approval-preview/' + id + '/qna')).data, /QA custom answer/);
    assert.equal(await db.college.findUnique({ where: { slug: marker } }), null);
  });
  await test('Anonymous and other staff cannot view the private submission', async () => {
    for (const client of [anon, other]) {
      const response = await client.request('/approval-preview/' + id);
      assert.ok(!response.data.includes(data.name));
    }
    assert.ok((await staff.request('/approval-preview/' + id)).data.includes(data.name));
  });
  await test('Admin gets a complete edit form while staff cannot edit the pending proposal', async () => {
    assert.match((await admin.request('/admin/approvals/' + id + '/edit')).data, /Edit Pending Submission/);
    assert.ok(!(await staff.request('/admin/approvals/' + id + '/edit')).data.includes('Save Submission Changes'));
    assert.equal((await staff.request('/api/v1/admin/approvals/' + id, 'PATCH', { data: { city: 'Pune' }, expectedUpdatedAt: version })).status, 403);
  });
  const edited = { name: marker + ' Admin Revised', city: 'Pune', state: 'Maharashtra', overviewHtml: '<p>Admin revised campus overview</p>' };
  let newVersion;
  await test('Admin edits remain pending and update the website preview without publishing', async () => {
    const response = ok(await admin.request('/api/v1/admin/approvals/' + id, 'PATCH', { data: edited, expectedUpdatedAt: version }));
    newVersion = response.updatedAt;
    const request = await db.collegeApprovalRequest.findUnique({ where: { id } });
    assert.equal(request.status, 'PENDING'); assert.equal(request.staffId, accounts[0].id);
    assert.equal(request.proposedData.city, 'Pune'); assert.equal(request.proposedData.admissionHtml, data.admissionHtml);
    assert.equal(await db.college.findUnique({ where: { slug: marker } }), null);
    const html = (await admin.request('/approval-preview/' + id)).data;
    assert.ok(html.includes(edited.name)); assert.match(html, /Admin revised campus overview/);
  });
  await test('Invalid data, stale edits and stale approvals are rejected', async () => {
    assert.equal((await admin.request('/api/v1/admin/approvals/' + id, 'PATCH', { data: { name: '' }, expectedUpdatedAt: newVersion })).status, 400);
    assert.equal((await admin.request('/api/v1/admin/approvals/' + id, 'PATCH', { data: { city: 'Wrong' }, expectedUpdatedAt: version })).status, 409);
    assert.equal((await admin.request('/api/v1/admin/approvals', 'PATCH', { requestId: id, action: 'APPROVE', expectedUpdatedAt: version })).status, 409);
  });
  await test('Approval publishes the admin-edited values and prevents further proposal editing', async () => {
    ok(await admin.request('/api/v1/admin/approvals', 'PATCH', { requestId: id, action: 'APPROVE', expectedUpdatedAt: newVersion }));
    const college = await db.college.findUnique({ where: { slug: marker } });
    assert.equal(college.name, edited.name); assert.equal(college.city, edited.city);
    assert.equal(college.overviewHtml, edited.overviewHtml); assert.equal(college.isPublished, true);
    assert.equal((await admin.request('/api/v1/admin/approvals/' + id, 'PATCH', { data: { city: 'Wrong' }, expectedUpdatedAt: newVersion })).status, 409);
    assert.ok((await anon.request('/college/' + marker)).data.includes(edited.name));
  });
  await test('Partial update previews merge existing fields and preserve the live profile until approved', async () => {
    const college = await db.college.findUnique({ where: { slug: marker } });
    const update = ok(await staff.request('/api/v1/cms/colleges/' + college.id, 'PATCH', { city: 'Mumbai' }));
    const html = (await admin.request('/approval-preview/' + update.requestId)).data;
    assert.ok(html.includes(edited.name)); assert.match(html, /Mumbai/); assert.match(html, /Admin revised campus overview/);
    assert.equal((await db.college.findUnique({ where: { id: college.id } })).city, 'Pune');
  });
  console.log(`${passed} approval preview checks passed.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  try {
    await db.college.deleteMany({ where: { slug: { startsWith: marker } } });
    await db.user.deleteMany({ where: { email: { startsWith: marker } } });
    console.log('Removed isolated preview fixtures.');
  } finally { await db.$disconnect(); }
});
