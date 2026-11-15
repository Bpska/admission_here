/* Local checks use isolated colleges/staff and remove them afterward. */
require('@next/env').loadEnvConfig(process.cwd());
const { PrismaClient } = require('@prisma/client');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Client } = require('./verify-staff-college-approval.cjs');
const db = new PrismaClient(), admin = new Client(), staff = new Client(), anon = new Client();
const marker = 'qa-navbar-gallery-' + crypto.randomUUID().slice(0, 8);
const password = crypto.randomBytes(18).toString('hex');
const ok = response => { assert.ok(response.status >= 200 && response.status < 300, JSON.stringify(response.data)); return response.data; };
const navigation = async () => ok(await anon.request('/api/v1/colleges/navigation')).colleges;
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('PASS', name); };
(async () => {
  assert.equal((await admin.login(process.env.QA_ADMIN_EMAIL || 'superadmin@admissionhere.in', process.env.QA_ADMIN_PASSWORD || 'Password@123'))?.role, 'SUPER_ADMIN');
  const college = ok(await admin.request('/api/v1/cms/colleges', 'POST', { name: marker, slug: marker, city: 'Bhubaneswar', state: 'Odisha', galleryUrls: [], isPublished: true })).college;
  await test('Empty galleries show an empty state on overview and gallery pages without stock photos', async () => {
    for (const tab of ['', '/gallery']) {
      const html = (await anon.request('/college/' + marker + tab)).data;
      assert.match(html, /Campus photos have not been added yet/);
      assert.ok(!html.includes('images.unsplash.com/photo-1541339907198-e08756dedf3f'));
    }
    assert.ok(!(await navigation()).some(row => row.id === college.id));
  });
  const photo = '/logo.png?qa-gallery=' + marker;
  await test('Added photo URLs display in both gallery views and removing them restores the empty state', async () => {
    ok(await admin.request('/api/v1/cms/colleges/' + college.id, 'PATCH', { galleryUrls: [photo] }));
    for (const tab of ['', '/gallery']) assert.ok((await anon.request('/college/' + marker + tab)).data.includes(photo));
    ok(await admin.request('/api/v1/cms/colleges/' + college.id, 'PATCH', { galleryUrls: [] }));
    for (const tab of ['', '/gallery']) assert.match((await anon.request('/college/' + marker + tab)).data, /Campus photos have not been added yet/);
  });
  await test('Navbar visibility requires a valid category', async () => {
    for (const data of [{ showInNavbar: true, navbarCategory: null }, { showInNavbar: true, navbarCategory: 'invalid' }, { navbarSection: 'invalid' }]) assert.equal((await admin.request('/api/v1/cms/colleges/' + college.id, 'PATCH', data)).status, 400);
  });
  await test('Published selected colleges appear under their saved navbar category', async () => {
    ok(await admin.request('/api/v1/cms/colleges/' + college.id, 'PATCH', { showInNavbar: true, navbarCategory: 'medical', navbarSection: 'column_1' }));
    const row = (await navigation()).find(row => row.id === college.id);
    assert.equal(row.navbarCategory, 'medical'); assert.equal(row.navbarSection, 'column_1'); assert.equal(row.slug, marker);
  });
  await test('Unpublished and unselected colleges are excluded from the navbar', async () => {
    ok(await admin.request('/api/v1/cms/colleges/' + college.id, 'PATCH', { isPublished: false }));
    assert.ok(!(await navigation()).some(row => row.id === college.id));
    ok(await admin.request('/api/v1/cms/colleges/' + college.id, 'PATCH', { isPublished: true, showInNavbar: false }));
    assert.ok(!(await navigation()).some(row => row.id === college.id));
  });
  const account = ok(await admin.request('/api/v1/admin/staff', 'POST', { name: marker, userId: marker + '@example.com', password, permissions: ['colleges'], assignedCollegeIds: [] })).staff;
  await staff.login(account.email, password);
  const proposal = ok(await staff.request('/api/v1/cms/colleges', 'POST', { name: marker + ' Staff', slug: marker + '-staff', city: 'Bhubaneswar', state: 'Odisha', showInNavbar: true, navbarCategory: 'engineering', navbarSection: 'column_2', galleryUrls: [] }));
  await test('Staff navbar selections remain pending and absent from public navigation', async () => {
    assert.equal(proposal.pendingApproval, true);
    assert.ok(!(await navigation()).some(row => row.slug === marker + '-staff'));
    assert.match((await admin.request('/approval-preview/' + proposal.requestId)).data, /Campus photos have not been added yet/);
  });
  await test('Admin can revise a pending navbar category and approval publishes that choice', async () => {
    const request = await db.collegeApprovalRequest.findUnique({ where: { id: proposal.requestId } });
    ok(await admin.request('/api/v1/admin/approvals/' + proposal.requestId, 'PATCH', { data: { navbarCategory: 'medical', navbarSection: 'column_3' }, expectedUpdatedAt: request.updatedAt.toISOString() }));
    ok(await admin.request('/api/v1/admin/approvals', 'PATCH', { requestId: proposal.requestId, action: 'APPROVE' }));
    const row = (await navigation()).find(row => row.slug === marker + '-staff');
    assert.equal(row.navbarCategory, 'medical'); assert.equal(row.navbarSection, 'column_3');
  });
  await test('Staff navbar changes wait for approval before moving or hiding a live college', async () => {
    const published = await db.college.findUnique({ where: { slug: marker + '-staff' } });
    const update = ok(await staff.request('/api/v1/cms/colleges/' + published.id, 'PATCH', { showInNavbar: true, navbarCategory: 'design', navbarSection: 'column_1' }));
    assert.equal((await navigation()).find(row => row.id === published.id).navbarCategory, 'medical');
    assert.equal((await navigation()).find(row => row.id === published.id).navbarSection, 'column_3');
    ok(await admin.request('/api/v1/admin/approvals', 'PATCH', { requestId: update.requestId, action: 'APPROVE' }));
    assert.equal((await navigation()).find(row => row.id === published.id).navbarCategory, 'design');
    assert.equal((await navigation()).find(row => row.id === published.id).navbarSection, 'column_1');
  });
  console.log(`${passed} navbar and gallery checks passed.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  try {
    await db.college.deleteMany({ where: { slug: { startsWith: marker } } });
    await db.user.deleteMany({ where: { email: marker + '@example.com' } });
    console.log('Removed isolated navbar/gallery fixtures.');
  } finally { await db.$disconnect(); }
});
