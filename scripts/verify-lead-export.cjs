/* Local regression: uses isolated records and removes them in finally. */
require('@next/env').loadEnvConfig(process.cwd());
const {PrismaClient} = require('@prisma/client');
const {Workbook} = require('exceljs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const db = new PrismaClient();
const base = process.env.QA_BASE_URL || 'http://localhost:3000';
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
const marker='qa-export-'+crypto.randomUUID().slice(0,8);
let passed=0;
const check=async(name,fn)=>{await fn();console.log('PASS',name);passed++;};
const admin=new Client(),staff=new Client(),anon=new Client();
async function workbook(client,query='') {
 const res=await fetch(base+'/api/v1/admin/enquiries?export=xlsx'+query,{headers:{cookie:Object.entries(client.cookies).map(([k,v])=>k+'='+v).join('; ')}});
 assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/spreadsheetml/);assert.match(res.headers.get('content-disposition'),/\.xlsx/);assert.match(res.headers.get('cache-control'),/no-store/);
 const book=new Workbook();await book.xlsx.load(Buffer.from(await res.arrayBuffer()));return book.getWorksheet('Student leads');
}
(async()=>{
 assert.equal((await admin.login(process.env.QA_ADMIN_EMAIL||'superadmin@admissionhere.in',process.env.QA_ADMIN_PASSWORD||'Password@123'))?.role,'SUPER_ADMIN');
 const college=await db.college.create({data:{name:marker,slug:marker,city:'Test City',state:'Odisha',ownershipType:'PRIVATE',overviewHtml:'<p>Export regression fixture</p>'}});
 const other=await db.college.create({data:{name:marker+' other',slug:marker+'-other',city:'Test City',state:'Odisha',ownershipType:'PRIVATE',overviewHtml:'<p>Export regression fixture</p>'}});
 await db.lead.createMany({data:Array.from({length:205},(_,i)=>({studentName:marker+' '+i,phone:'+919876543210',targetStream:'Engineering',sourceUrl:'/qa-export',ctaType:'APPLY_NOW',targetCollegeId:college.id,counselorNotes:i===0?'=HYPERLINK("https://example.com")':'line one\nline two, "quoted"'}))});
 await db.lead.create({data:{studentName:marker+' private',phone:'0987654321',targetStream:'Engineering',sourceUrl:'/qa-export',ctaType:'APPLY_NOW',targetCollegeId:other.id}});
 await check('Dashboard cards link to all four lists',async()=>{const html=(await admin.request('/admin')).data;for(const [path,label] of [['enquiries','Student Leads'],['colleges','Indexed Colleges'],['blogs','Editorial Articles'],['users','Platform Users']])assert.match(html,new RegExp('href="/admin/'+path+'"[^]*?'+label));});
 await check('All lead records are listed beyond the former 150/200 caps',async()=>{const r=await admin.request('/api/v1/admin/enquiries?search='+marker);assert.equal(r.status,200);assert.equal(r.data.totalCount,206);assert.equal(r.data.leads.length,206);});
 await check('Excel includes all authorized database leads',async()=>{const sheet=await workbook(admin);assert.equal(sheet.rowCount-1,await db.lead.count());});
 await check('Excel preserves phone text, multiline notes and formula-like text',async()=>{const sheet=await workbook(admin,'&search='+marker);assert.equal(sheet.rowCount,207);let found=false;sheet.eachRow((row,n)=>{if(n===1)return;if(row.getCell(13).value==='=HYPERLINK("https://example.com")'){found=true;assert.equal(row.getCell(13).type,3);assert.equal(row.getCell(3).value,'+919876543210');}});assert.ok(found);});
 const password=crypto.randomBytes(16).toString('hex');const user=await db.user.create({data:{name:marker+' Staff',email:marker+'@example.com',role:'STAFF',passwordHash:await require('bcryptjs').hash(password,10),staffPermission:{create:{permissions:['leads'],assignedCollegeIds:[college.id]}}}});assert.equal((await staff.login(user.email,password))?.role,'STAFF');
 await check('Staff Excel includes assigned-college leads only',async()=>{const sheet=await workbook(staff);assert.equal(sheet.rowCount-1,205);sheet.eachRow((row,n)=>{if(n>1)assert.equal(row.getCell(10).value,college.name);});});
 await check('Unassigned college and anonymous downloads are denied',async()=>{assert.equal((await staff.request('/api/v1/admin/enquiries?export=xlsx&collegeId='+other.id)).status,403);assert.equal((await anon.request('/api/v1/admin/enquiries?export=xlsx')).status,401);});
 await check('Downloads denied after lead permission is revoked',async()=>{await db.staffPermission.update({where:{userId:user.id},data:{permissions:[]}});assert.equal((await staff.request('/api/v1/admin/enquiries?export=xlsx')).status,401);});
 console.log(passed+' checks passed');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{try{await db.lead.deleteMany({where:{studentName:{startsWith:marker}}});await db.user.deleteMany({where:{email:marker+'@example.com'}});await db.college.deleteMany({where:{slug:{startsWith:marker}}});console.log('Temporary export records removed.');}finally{await db.$disconnect();}});
