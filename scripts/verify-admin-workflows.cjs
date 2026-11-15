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
const stateFile = path.join(os.tmpdir(), 'admission-admin-regression.json');
const keep = process.argv.includes('--keep-fixtures');
const cleanupOnly = process.argv.includes('--cleanup');
const state = cleanupOnly ? JSON.parse(fs.readFileSync(stateFile)) : { marker: 'qa-fix-' + crypto.randomUUID().slice(0, 8), ids: {}, results: [] };
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
  if (cleanupOnly) { await cleanup(); return; }
  const actor = await admin.login(process.env.QA_ADMIN_EMAIL || 'superadmin@admissionhere.in', process.env.QA_ADMIN_PASSWORD || 'Password@123');
  assert.equal(actor?.role, 'SUPER_ADMIN', 'A Super Admin session is required');
  state.adminCookies = admin.cookies; persist();
  const created = ok(await admin.request('/api/v1/cms/colleges', 'POST', { name: state.marker+' College', slug: state.marker, city: 'Bhubaneswar', state: 'Odisha', overviewHtml: '<p>'+state.marker+' public overview</p>', isPublished: true }));
  state.ids.college = created.college.id; persist();
  const other = ok(await admin.request('/api/v1/cms/colleges', 'POST', { name: state.marker+' Other', slug: state.marker+'-other', city: 'Bhubaneswar', state: 'Odisha', overviewHtml: '<p>QA other college</p>', isPublished: true }));
  state.ids.otherCollege = other.college.id; persist();

  await test('A10 College SEO and overview edits appear publicly', async () => {
    ok(await admin.request('/api/v1/cms/colleges/'+state.ids.college, 'PATCH', { metaTitle: state.marker+' CUSTOM TITLE', metaDescription: state.marker+' CUSTOM DESCRIPTION', brochurePdfUrl: 'https://www.nitrkl.ac.in/docs/Announcement/10072026175144558.pdf', overviewHtml: '<p>'+state.marker+' UPDATED OVERVIEW</p>' }));
    const response = await anonymous.request('/college/'+state.marker);
    assert.match(response.data, new RegExp(state.marker+' CUSTOM TITLE')); assert.match(response.data, /UPDATED OVERVIEW/); assert.match(response.data, /CUSTOM DESCRIPTION/);
  });
  await test('A09 New college admin brochure is available', async () => {
    const response = await anonymous.request('/api/v1/colleges/'+state.ids.college+'/brochures'); assert.equal(ok(response).brochures.length, 1);
    assert.match(response.data.brochures[0].url, /nitrkl.ac.in/);
  });
  await test('A06 Unpublished college content is inaccessible', async () => {
    ok(await admin.request('/api/v1/cms/colleges/'+state.ids.college, 'PATCH', { isPublished: false }));
    const response = await anonymous.request('/college/'+state.marker); assert.ok(!response.data.includes('UPDATED OVERVIEW'));
    assert.equal((await anonymous.request('/api/v1/colleges/'+state.ids.college+'/brochures')).status,404);
    ok(await admin.request('/api/v1/cms/colleges/'+state.ids.college, 'PATCH', { isPublished: true }));
  });
  const blog = ok(await admin.request('/api/v1/cms/blogs', 'POST', { title: state.marker+' Article', contentMdx: 'QA_PRIVATE_DRAFT_BODY '+state.marker, publish: false })); state.ids.blog = blog.post.id; state.blogSlug = blog.post.slug; persist();
  await test('A07 Draft and archived blog bodies are private', async () => {
    assert.ok(!(await anonymous.request('/blog/'+state.blogSlug)).data.includes('QA_PRIVATE_DRAFT_BODY'));
    ok(await admin.request('/api/v1/cms/blogs/'+state.ids.blog, 'PATCH', { status: 'PUBLISHED' }));
    assert.match((await anonymous.request('/blog/'+state.blogSlug)).data, /QA_PRIVATE_DRAFT_BODY/);
    ok(await admin.request('/api/v1/cms/blogs/'+state.ids.blog, 'PATCH', { status: 'ARCHIVED' }));
    assert.ok(!(await anonymous.request('/blog/'+state.blogSlug)).data.includes('QA_PRIVATE_DRAFT_BODY'));
  });
  await test('A01 Anonymous publishing is denied', async () => { const response = await anonymous.request('/api/v1/cms/publish','POST',{blogId:state.ids.blog}); assert.equal(response.status,401); });
  await test('A15 Publish button saves publishedAt', async () => { ok(await admin.request('/api/v1/cms/blogs/'+state.ids.blog,'PATCH',{status:'PUBLISHED'})); assert.ok((await db.blogPost.findUnique({where:{id:state.ids.blog}})).publishedAt); });
  await test('A14 Live blog updates persist and render', async () => {
    const liveUpdatesJson=[{id:crypto.randomUUID(),timestamp:new Date().toISOString(),headline:state.marker+' LIVE HEADLINE',bodyHtml:'QA live content',isPinned:true}];
    ok(await admin.request('/api/v1/cms/blogs','POST',{id:state.ids.blog,title:state.marker+' Article',contentMdx:'QA published live article content',isLiveBlog:true,liveUpdatesJson,publish:true}));
    assert.equal((await db.blogPost.findUnique({where:{id:state.ids.blog}})).liveUpdatesJson.length,1);
    assert.match((await anonymous.request('/blog/'+state.blogSlug)).data,/LIVE HEADLINE/);
  });
  const review=await db.review.create({data:{collegeId:state.ids.college,userId:actor.id,courseName:'QA B.Tech',batchYear:2026,ratingOverall:4,ratingPlacements:4,ratingInfra:4,ratingFaculty:4,ratingValueRoi:4,title:state.marker+' Review',prosText:'QA review only',consText:'QA review only'}}); state.ids.review=review.id;persist();
  await test('A02 Anonymous moderation is denied', async()=>{assert.equal((await anonymous.request('/api/v1/cms/reviews/moderate','POST',{reviewId:review.id,status:'APPROVED'})).status,401);});
  await test('A12 Review moderation updates count and rating', async()=>{
    ok(await admin.request('/api/v1/cms/reviews/moderate','POST',{reviewId:review.id,status:'APPROVED'}));
    let c=await db.college.findUnique({where:{id:state.ids.college}});assert.equal(c.reviewCount,1);assert.equal(c.ratingOverall,4);
    ok(await admin.request('/api/v1/cms/reviews/moderate','POST',{reviewId:review.id,status:'REJECTED'}));c=await db.college.findUnique({where:{id:state.ids.college}});assert.equal(c.reviewCount,0);assert.equal(c.ratingOverall,0);
  });
  const lead=ok(await anonymous.request('/api/v1/leads/capture','POST',{studentName:state.marker+' Student',phone:'9876501234',email:state.marker+'@example.com',targetStream:'Engineering',targetCollegeId:state.ids.college,sourceUrl:'/qa',ctaType:'APPLY_NOW'}));state.ids.lead=lead.leadId;persist();
  await test('A08 Enquiry status and notes persist', async()=>{ok(await admin.request('/api/v1/admin/enquiries','PATCH',{id:lead.leadId,status:'CONTACTED',counselorNotes:'QA API persistent note'}));const saved=await db.lead.findUnique({where:{id:lead.leadId}});assert.equal(saved.status,'CONTACTED');assert.equal(saved.counselorNotes,'QA API persistent note');});
  await test('A11 Enquiries can be found by college name',async()=>{const response=ok(await admin.request('/api/v1/admin/enquiries?search='+encodeURIComponent(state.marker+' College')));assert.ok(response.leads.some(row=>row.id===lead.leadId));});

  state.staffPassword=crypto.randomBytes(16).toString('hex'); state.staffEmail=state.marker+'-staff@example.com';persist();
  const account=ok(await admin.request('/api/v1/admin/staff','POST',{name:state.marker+' Staff',userId:state.staffEmail,password:state.staffPassword,permissions:['colleges','blogs','leads','reviews'],assignedCollegeIds:[state.ids.college]}));state.ids.staff=account.staff.id;persist();
  assert.equal((await staff.login(state.staffEmail,state.staffPassword))?.role,'STAFF');state.staffCookies=staff.cookies;persist();
  await test('A05 Staff cannot access unassigned colleges',async()=>{assert.equal((await staff.request('/api/v1/cms/colleges/'+state.ids.otherCollege)).status,403);const list=ok(await staff.request('/api/v1/cms/colleges'));assert.ok(list.colleges.every(row=>row.id===state.ids.college));});
  await test('A04 Revoked permissions affect existing sessions',async()=>{ok(await admin.request('/api/v1/admin/staff','PATCH',{id:state.ids.staff,permissions:['colleges']}));assert.equal((await staff.request('/api/v1/cms/blogs')).status,401);ok(await admin.request('/api/v1/admin/staff','PATCH',{id:state.ids.staff,permissions:['colleges','blogs','leads','reviews']}));});
  await test('A03 Disabled staff cannot log in or retain access',async()=>{ok(await admin.request('/api/v1/admin/staff','PATCH',{id:state.ids.staff,isActive:false}));try { const disabled=new Client();assert.ok(!await disabled.login(state.staffEmail,state.staffPassword));assert.equal((await staff.request('/api/v1/cms/colleges')).status,401); } finally { ok(await admin.request('/api/v1/admin/staff','PATCH',{id:state.ids.staff,isActive:true})); }});
  await test('A17 Approval applies once and closed requests are immutable',async()=>{
    const pending=ok(await staff.request('/api/v1/cms/colleges/'+state.ids.college,'PATCH',{hostelInfo:'QA approved hostel'}));assert.ok(pending.pendingApproval);
    ok(await admin.request('/api/v1/admin/approvals','PATCH',{requestId:pending.requestId,action:'APPROVE'}));assert.equal((await db.college.findUnique({where:{id:state.ids.college}})).hostelInfo,'QA approved hostel');
    assert.equal((await admin.request('/api/v1/admin/approvals','PATCH',{requestId:pending.requestId,action:'APPROVE'})).status,409);
    const next=ok(await staff.request('/api/v1/cms/colleges/'+state.ids.college,'PATCH',{hostelInfo:'QA rejected hostel'}));ok(await admin.request('/api/v1/admin/approvals','PATCH',{requestId:next.requestId,action:'REJECT'}));assert.equal((await admin.request('/api/v1/admin/approvals','PATCH',{requestId:next.requestId,action:'APPROVE'})).status,409);
  });
  await test('M02 Users can be created, edited, assigned roles and deleted',async()=>{
    const user=await create('users',{name:state.marker+' User',email:state.marker+'-user@example.com',password:'QAtestPassword123',role:'STUDENT',isActive:true});
    ok(await admin.request('/api/v1/admin/data/users','PATCH',{id:user.id,data:{role:'AUTHOR',name:state.marker+' Editor'}}));
    const editor=new Client();assert.equal((await editor.login(state.marker+'-user@example.com','QAtestPassword123'))?.role,'AUTHOR');assert.equal((await editor.request('/api/v1/cms/blogs')).status,200);
    result('A16 AUTHOR editorial access',true);
    const list=ok(await admin.request('/api/v1/admin/data/users'));assert.ok(!JSON.stringify(list).includes('passwordHash'));
    ok(await admin.request('/api/v1/admin/data/users','DELETE',{id:user.id}));
    assert.equal((await admin.request('/api/v1/admin/data/users','PATCH',{id:actor.id,data:{isActive:false}})).status,400);
  });
  await test('M01 Exam create, edit, public update and delete',async()=>{
    const exam=await create('exams',{name:state.marker+' Exam',slug:state.marker+'-exam',conductingBody:'QA Examination Board',stream:'Engineering',examLevel:'National',overviewHtml:'<p>QA exam overview</p>',syllabusHtml:'<p>QA syllabus</p>',examDate:'2027-04-15T04:30:00Z'});
    ok(await admin.request('/api/v1/admin/data/exams','PATCH',{id:exam.id,data:{overviewHtml:'<p>QA UPDATED EXAM OVERVIEW</p>'}}));
    assert.match((await anonymous.request('/exams/'+state.marker+'-exam')).data,/UPDATED EXAM OVERVIEW/);
  });
  await test('M03 Course catalog and college fees CRUD',async()=>{
    const course=await create('courses',{slug:state.marker+'-course',fullName:'QA Bachelor of Technology',stream:'Engineering',degree:'B.Tech',durationYrs:4,level:'UG'});
    const offering=await create('offerings',{courseId:course.id,specialization:'QA Computer Science',totalFeesInr:400000,firstYearFeesInr:100000,hostelFeesYearlyInr:30000,intakeSeats:60,acceptedExamSlugs:[state.marker+'-exam'],minimumClass12Percent:75},state.ids.college);
    ok(await admin.request('/api/v1/admin/data/offerings','PATCH',{id:offering.id,collegeId:state.ids.college,data:{totalFeesInr:450000}}));
    assert.equal((await db.collegeCourse.findUnique({where:{id:offering.id}})).totalFeesInr,450000);
    assert.match((await anonymous.request('/college/'+state.marker+'/courses-fees')).data,/QA Computer Science/);
  });
  await test('M03 Cutoff create, edit and public update',async()=>{
    const cutoff=await create('cutoffs',{examId:state.ids.exams,collegeCourseId:state.ids.offerings,academicYear:2027,counselingRound:1,category:'GEN',quota:'AI',gender:'Gender-Neutral',openingRank:1000,closingRank:2000},state.ids.college);
    ok(await admin.request('/api/v1/admin/data/cutoffs','PATCH',{id:cutoff.id,collegeId:state.ids.college,data:{closingRank:2500}}));assert.equal((await db.examCutoff.findUnique({where:{id:cutoff.id}})).closingRank,2500);
    assert.match((await anonymous.request('/college/'+state.marker+'/cutoff')).data,/2,500/);
  });
  await test('M03 Placement create, edit and public update',async()=>{
    const row=await create('placements',{batchYear:2027,highestPackageInr:5000000,averagePackageInr:1500000,medianPackageInr:1200000,placementPercentage:90,totalOffers:45,topRecruiters:['QA Recruiter']},state.ids.college);
    ok(await admin.request('/api/v1/admin/data/placements','PATCH',{id:row.id,collegeId:state.ids.college,data:{totalOffers:50}}));assert.equal((await db.placementStat.findUnique({where:{id:row.id}})).totalOffers,50);assert.match((await anonymous.request('/college/'+state.marker+'/placements')).data,/QA Recruiter/);
  });
  await test('M03 Ranking create, edit and public update',async()=>{
    const row=await create('rankings',{agencyName:'QA Ranking Agency',category:'Engineering',rankingYear:2027,rankNumber:25,outOfTotal:500},state.ids.college);
    ok(await admin.request('/api/v1/admin/data/rankings','PATCH',{id:row.id,collegeId:state.ids.college,data:{rankNumber:20}}));assert.equal((await db.agencyRanking.findUnique({where:{id:row.id}})).rankNumber,20);assert.match((await anonymous.request('/college/'+state.marker+'/rankings')).data,/QA Ranking Agency/);
  });
  await test('Staff related-data changes require approval',async()=>{
    const response=ok(await staff.request('/api/v1/admin/data/placements','PATCH',{id:state.ids.placements,collegeId:state.ids.college,data:{totalOffers:55}}));assert.ok(response.pendingApproval);assert.equal((await db.placementStat.findUnique({where:{id:state.ids.placements}})).totalOffers,50);
    ok(await admin.request('/api/v1/admin/approvals','PATCH',{requestId:response.requestId,action:'APPROVE'}));assert.equal((await db.placementStat.findUnique({where:{id:state.ids.placements}})).totalOffers,55);
  });
  await test('New editors enforce scope and validate related IDs',async()=>{
    assert.equal((await staff.request('/api/v1/admin/data/placements?collegeId='+state.ids.otherCollege)).status,403);
    assert.equal((await admin.request('/api/v1/admin/data/offerings','PATCH',{id:state.ids.offerings,collegeId:state.ids.otherCollege,data:{totalFeesInr:1}})).status,400);
    assert.equal((await anonymous.request('/api/v1/admin/data/exams')).status,403);
  });
  await test('Public FAQs, gallery and admission text update',async()=>{
    ok(await admin.request('/api/v1/cms/colleges/'+state.ids.college,'PATCH',{faqsJson:[{question:'QA question?',answer:'QA SAVED FAQ ANSWER'}],galleryUrls:['/images/campuses/nit-rourkela/nit-rourkela-main-gate.jpg'],admissionHtml:'<p>QA SAVED ADMISSION TEXT</p>'}));
    assert.match((await anonymous.request('/college/'+state.marker+'/qna')).data,/QA SAVED FAQ ANSWER/);assert.match((await anonymous.request('/college/'+state.marker+'/admission')).data,/QA SAVED ADMISSION TEXT/);assert.match((await anonymous.request('/college/'+state.marker+'/gallery')).data,/nit-rourkela-main-gate.jpg/);
  });
  if (!keep) await test('New editor delete actions',async()=>{
    for(const resource of ['cutoffs','placements','rankings','offerings','courses','exams']) { if(state.ids[resource]) ok(await admin.request('/api/v1/admin/data/'+resource,'DELETE',{id:state.ids[resource],collegeId:state.ids.college})); }
  });
  persist();
})().catch(error=>{result('Regression setup',false,error.message);process.exitCode=1;}).finally(async()=>{
  if (!keep && !cleanupOnly) await cleanup();
  await db.$disconnect();
  const failures=state.results.filter(item=>!item.passed);if(failures.length)process.exitCode=1;
  console.log(`${state.results.filter(item=>item.passed).length} passed; ${failures.length} failed.`);
});
