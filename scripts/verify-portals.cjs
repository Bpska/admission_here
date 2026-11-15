/* Integration checks against a running local app. Only isolated qa-fix-* fixtures are modified. */
require('@next/env').loadEnvConfig(process.cwd());
const { PrismaClient } = require('@prisma/client');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const db = new PrismaClient();
const base = process.env.QA_BASE_URL || 'http://localhost:3000';
const stateFile = path.join(os.tmpdir(), 'admission-portal-regression.json');
const keep = process.argv.includes('--keep-fixtures');
const cleanupOnly = process.argv.includes('--cleanup');
const state = cleanupOnly ? JSON.parse(fs.readFileSync(stateFile)) : { marker: 'qa-portal-' + crypto.randomUUID().slice(0, 8), ids: {}, results: [] };
const persist = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
const result = (name, passed, detail = '') => { state.results.push({ name, passed, detail }); persist(); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const test = async (name, fn) => { try { await fn(); result(name, true); } catch (error) { result(name, false, error.message); } };
class Client {
  constructor() { this.cookies = {}; }
  async request(url, method = 'GET', body) {
    const headers = { cookie: Object.entries(this.cookies).map(([key,value])=>key+'='+value).join('; ') };
    if (body !== undefined) headers['Content-Type'] = body instanceof URLSearchParams ? 'application/x-www-form-urlencoded' : 'application/json';
    const response = await fetch(base + url, { method, headers, body: body === undefined ? undefined : body instanceof URLSearchParams ? body : JSON.stringify(body), redirect: 'manual' });
    for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0], split = pair.indexOf('='); this.cookies[pair.slice(0,split)] = pair.slice(split+1); }
    const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, data };
  }
  async login(email, password) {
    const csrf = await this.request('/api/auth/csrf');
    await this.request('/api/auth/callback/credentials', 'POST', new URLSearchParams({ csrfToken: csrf.data.csrfToken, email, password, callbackUrl: base + '/admin' }));
    return (await this.request('/api/auth/session')).data?.user;
  }
}
const admin = new Client(), anonymous = new Client(), staff = new Client();
const ok = response => { assert.ok(response.status >= 200 && response.status < 300, JSON.stringify(response.data)); return response.data; };
async function create(resource, data, collegeId) {
  const response = await admin.request('/api/v1/admin/data/'+resource, 'POST', { data, collegeId });
  const row = ok(response).row;
  state.ids[resource] = row.id; persist(); return row;
}
async function cleanup() {
  // Exact IDs plus marker checks prevent cleanup from touching pre-existing data.
  await db.lead.deleteMany({ where: { studentName: { startsWith: state.marker } } });
  await db.review.deleteMany({ where: { title: { startsWith: state.marker } } });
  await db.blogPost.deleteMany({ where: { slug: { startsWith: state.marker } } });
  await db.user.deleteMany({ where: { email: { startsWith: state.marker } } });
  await db.college.deleteMany({ where: { slug: { startsWith: state.marker } } });
  await db.exam.deleteMany({ where: { slug: { startsWith: state.marker } } });
  await db.course.deleteMany({ where: { slug: { startsWith: state.marker } } });
  state.cleaned = true; persist();
  console.log('Removed isolated regression fixtures.');
}

(async () => {
 if (cleanupOnly) {await cleanup();return;}
 const actor=await admin.login(process.env.QA_ADMIN_EMAIL || 'superadmin@admissionhere.in',process.env.QA_ADMIN_PASSWORD || 'Password@123');assert.equal(actor?.role,'SUPER_ADMIN');state.adminCookies=admin.cookies;
 state.password=crypto.randomBytes(16).toString('hex');
 const users=[];for(let i=0;i<2;i++){const u=await db.user.create({data:{name:state.marker+' Applicant '+i,email:state.marker+'-applicant'+i+'@example.com',passwordHash:await require('bcryptjs').hash(state.password,10),role:'STUDENT'}});users.push(u);}
 state.studentEmail=users[0].email;state.ids.student=users[0].id;persist();
 const student=new Client(),other=new Client();assert.equal((await student.login(users[0].email,state.password))?.role,'STUDENT');await other.login(users[1].email,state.password);state.studentCookies=student.cookies;persist();
 const c=ok(await admin.request('/api/v1/cms/colleges','POST',{name:state.marker+' College',slug:state.marker,city:'Bhubaneswar',state:'Odisha',isPublished:true})).college;state.ids.college=c.id;persist();
 await test('Student portal requires login',async()=>{assert.equal((await anonymous.request('/api/v1/student')).status,401);const page=await anonymous.request('/student');assert.ok(page.status===307 || page.data.includes('NEXT_REDIRECT'));assert.ok(!page.data.includes('Your applications and brochure requests'));});
 await test('Student portal renders for arbitrary student email',async()=>{assert.match((await student.request('/student')).data,/My student portal/);assert.equal((await student.request('/admin')).status,307);});
 await test('Student profile saves without role or account escalation',async()=>{ok(await student.request('/api/v1/student','PATCH',{name:state.marker+' Updated',phone:'',targetStream:'Engineering',examScores:{entranceExam:'jee-main',rank:15000,category:'GEN',homeState:'Odisha'},role:'SUPER_ADMIN',id:actor.id}));const u=await db.user.findUnique({where:{id:users[0].id}});assert.equal(u.role,'STUDENT');assert.equal(u.examScores.rank,15000);assert.match(u.name,/Updated/);});
 await test('Profile rejects invalid rank, percentile and home state',async()=>{for(const examScores of [{entranceExam:'cat',rank:101,category:'GEN',homeState:'Odisha'},{entranceExam:'jee-main',rank:0,category:'GEN',homeState:'Odisha'},{entranceExam:'jee-main',rank:1,category:'GEN',homeState:'invalid'}])assert.equal((await student.request('/api/v1/student','PATCH',{name:'Test Name',phone:'',targetStream:'Engineering',examScores})).status,400);});
 const body={studentName:state.marker+' Applicant',phone:'9876543210',email:users[0].email,targetStream:'Engineering',targetCollegeId:c.id,ctaType:'APPLY_NOW',userId:users[1].id};
 await test('Apply links to signed-in student and prevents repeated submissions',async()=>{const lead=ok(await student.request('/api/v1/leads/capture','POST',body));state.ids.lead=lead.leadId;assert.equal((await db.lead.findUnique({where:{id:lead.leadId}})).userId,users[0].id);assert.equal(ok(await student.request('/api/v1/leads/capture','POST',body)).leadId,lead.leadId);});
 await test('Applications are private and hide counselor notes',async()=>{await db.lead.update({where:{id:state.ids.lead},data:{counselorNotes:'PRIVATE_NOTE'}});assert.equal(ok(await student.request('/api/v1/student')).applications.length,1);assert.equal(ok(await other.request('/api/v1/student')).applications.length,0);assert.ok(!JSON.stringify(ok(await student.request('/api/v1/student'))).includes('PRIVATE_NOTE'));});
 await test('Students cannot access staff data or moderation',async()=>{assert.ok([401,403].includes((await student.request('/api/v1/cms/colleges')).status));assert.ok([401,403].includes((await student.request('/api/v1/admin/enquiries')).status));assert.equal((await student.request('/api/v1/cms/reviews/moderate','POST',{reviewId:crypto.randomUUID(),status:'APPROVED'})).status,401);});
 const review={collegeId:c.id,title:state.marker+' Review',courseName:'B.Tech',batchYear:2027,ratingOverall:4,ratingPlacements:4,ratingInfra:3,ratingFaculty:5,ratingValueRoi:4,prosText:'Helpful faculty and a good library.',consText:'The hostel facilities can improve.',moderationStatus:'APPROVED',userId:users[1].id};
 await test('Review submission is pending and attached to the correct student',async()=>{ok(await student.request('/api/v1/student/reviews','POST',review));const row=await db.review.findFirst({where:{userId:users[0].id,collegeId:c.id}});state.ids.review=row.id;assert.equal(row.moderationStatus,'PENDING');assert.equal(ok(await other.request('/api/v1/student')).reviews.length,0);});
 state.staffEmail=state.marker+'-staff@example.com';state.staffPassword=state.password;
 const staffAccount=ok(await admin.request('/api/v1/admin/staff','POST',{name:state.marker+' Staff',userId:state.staffEmail,password:state.password,permissions:['colleges','blogs','leads','reviews'],assignedCollegeIds:[c.id]}));state.ids.staff=staffAccount.staff.id;await staff.login(state.staffEmail,state.password);state.staffCookies=staff.cookies;persist();
 await test('Staff moderation updates public reviews and student status',async()=>{ok(await staff.request('/api/v1/cms/reviews/moderate','POST',{reviewId:state.ids.review,status:'APPROVED'}));assert.equal(ok(await student.request('/api/v1/student')).reviews[0].moderationStatus,'APPROVED');assert.match((await anonymous.request('/college/'+state.marker+'/reviews')).data,new RegExp(state.marker+' Review'));const college=await db.college.findUnique({where:{id:c.id}});assert.equal(college.reviewCount,1);assert.equal(college.ratingOverall,4);});
 await test('Review edits return to moderation without duplicate reviews or stale ratings',async()=>{ok(await student.request('/api/v1/student/reviews','POST',{...review,ratingOverall:5}));assert.equal(await db.review.count({where:{collegeId:c.id,userId:users[0].id}}),1);assert.equal((await db.college.findUnique({where:{id:c.id}})).reviewCount,0);assert.equal(ok(await student.request('/api/v1/student')).reviews[0].moderationStatus,'PENDING');});
 await test('Review validation and anonymous access',async()=>{assert.equal((await anonymous.request('/api/v1/student/reviews','POST',review)).status,401);assert.equal((await student.request('/api/v1/student/reviews','POST',{...review,ratingOverall:6})).status,400);});
 await test('Staff lead status changes reach the student portal',async()=>{ok(await staff.request('/api/v1/admin/enquiries','PATCH',{id:state.ids.lead,status:'CONTACTED',counselorNotes:'Internal staff note'}));assert.equal(ok(await student.request('/api/v1/student')).applications[0].status,'CONTACTED');});
 await test('Staff dashboard and sign-out controls render',async()=>{const html=(await staff.request('/admin')).data;assert.match(html,/Sign out/);assert.ok(!html.includes('href="/admin/blogs:publish"'));assert.match(html,/Dashboard/);});
 await test('Staff blog creation honors permission revocation',async()=>{ok(await admin.request('/api/v1/admin/staff','PATCH',{id:state.ids.staff,permissions:['colleges','leads','reviews']}));const html=(await staff.request('/admin/staff-blogs/new')).data;assert.ok(!html.includes('Write New Blog Article'));ok(await admin.request('/api/v1/admin/staff','PATCH',{id:state.ids.staff,permissions:['colleges','blogs','leads','reviews']}));});
 await test('Predictor rejects invalid ranks, CAT percentiles and missing quota states',async()=>{for(const input of [{examSlug:'cat',rank:101},{examSlug:'jee-main',rank:0},{examSlug:'jee-main',rank:1.5},{examSlug:'jee-main',rank:100,quota:'HS'}])assert.equal((await anonymous.request('/api/v1/predictor','POST',input)).status,400);});
 await test('Predictor returns only recorded cutoffs and eligible home-state options',async()=>{const r=ok(await anonymous.request('/api/v1/predictor','POST',{examSlug:'jee-main',rank:15000,quota:'ALL',category:'GEN',homeState:'Odisha'}));for(const item of Object.values(r.predictions).flat()){assert.ok(item.closingRank>0);if(item.quota==='HS')assert.equal(item.state,'Odisha');if(item.quota==='OS')assert.notEqual(item.state,'Odisha');}});
 await test('Counselor uses the query and avoids unverified quota claims',async()=>{const r=ok(await anonymous.request('/api/v1/ai/counselor','POST',{query:state.marker+' College'}));assert.ok(r.colleges.some(row=>row.name===c.name));assert.ok(!r.answer.includes('50%'));});
 await test('Sign out invalidates student session',async()=>{const csrf=ok(await other.request('/api/auth/csrf'));await other.request('/api/auth/signout','POST',new URLSearchParams({csrfToken:csrf.csrfToken,callbackUrl:base+'/login'}));assert.equal((await other.request('/api/v1/student')).status,401);});
 console.log(`${state.results.filter(r=>r.passed).length} passed, ${state.results.filter(r=>!r.passed).length} failed`);if(state.results.some(r=>!r.passed))process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{try{if(!keep&&!cleanupOnly)await cleanup();}finally{await db.$disconnect();}});
