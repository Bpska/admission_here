/* Local regression: isolated users, images and blogs are removed after checking. */
require('@next/env').loadEnvConfig(process.cwd());
const {PrismaClient}=require('@prisma/client'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {Client}=require('./verify-staff-college-approval.cjs');
const db=new PrismaClient(),admin=new Client(),author=new Client(),other=new Client(),anon=new Client();
const base=process.env.QA_BASE_URL||'http://localhost:3000',marker='qa-blog-images-'+crypto.randomUUID().slice(0,8),imageIds=[];
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDV8AAAAASUVORK5CYII=','base64');
const ok=r=>{assert.ok(r.status>=200&&r.status<300,JSON.stringify(r.data));return r.data};let passed=0;
const test=async(name,fn)=>{await fn();passed++;console.log('PASS',name)};
async function upload(client,data=png,type='image/png',filename='campus.png'){
 const form=new FormData();form.append('file',new Blob([data],{type}),filename);
 const response=await fetch(base+'/api/v1/cms/blog-images',{method:'POST',headers:{cookie:Object.entries(client.cookies).map(([k,v])=>k+'='+v).join('; ')},body:form});
 const result=await response.json();if(result.id)imageIds.push(result.id);return {status:response.status,data:result};
}
(async()=>{
 assert.equal((await admin.login(process.env.QA_ADMIN_EMAIL||'superadmin@admissionhere.in',process.env.QA_ADMIN_PASSWORD||'Password@123'))?.role,'SUPER_ADMIN');
 const password=crypto.randomBytes(18).toString('hex');
 const users=[];for(const suffix of ['-author','-other']){const staff=ok(await admin.request('/api/v1/admin/staff','POST',{name:marker+suffix,userId:marker+suffix+'@example.com',password,permissions:['blogs'],assignedCollegeIds:[]})).staff;users.push(staff)}
 await author.login(users[0].email,password);await other.login(users[1].email,password);
 await test('Anonymous image uploads are blocked',async()=>{assert.equal((await upload(anon)).status,403)});
 let first,second;
 await test('Authors can upload multiple persistent image files',async()=>{first=ok(await upload(author));second=ok(await upload(author));assert.notEqual(first.id,second.id);assert.equal((await db.blogImage.findUnique({where:{id:first.id}})).size,png.length)});
 await test('Draft pictures are visible only to the uploader and admin',async()=>{for(const client of [author,admin])assert.equal((await client.request(first.url)).status,200);for(const client of [anon,other])assert.equal((await client.request(first.url)).status,404)});
 await test('SVG, spoofed MIME types and oversized files are rejected',async()=>{assert.equal((await upload(author,Buffer.from('<svg></svg>'),'image/svg+xml','bad.svg')).status,400);assert.equal((await upload(author,png,'image/jpeg','bad.jpg')).status,400);assert.equal((await upload(author,Buffer.alloc(3*1024*1024+1),'image/png','large.png')).status,413)});
 const content=`<h2>Rich blog heading</h2><p><strong>Bold text</strong> <em>Italic</em> <u>Underline</u> <mark>Highlight</mark> <a href="https://example.com">Official link</a></p><img src="${first.url}" alt="First campus"><p>Between images</p><img src="${second.url}" alt="Second campus">`;
 await test('Another author cannot publish someone else’s private image',async()=>{assert.equal((await other.request('/api/v1/cms/blogs','POST',{title:marker+' blocked',contentMdx:content,publish:true})).status,400)});
 let blog;
 await test('Formatted content and multiple pictures save as a private draft',async()=>{blog=ok(await author.request('/api/v1/cms/blogs','POST',{title:marker,contentMdx:content,publish:false})).post;const row=await db.blogPost.findUnique({where:{id:blog.id}});assert.equal(row.contentMdx,content);assert.equal(row.status,'DRAFT');assert.equal((await anon.request(first.url)).status,404)});
 await test('Publishing makes referenced pictures publicly readable with the correct content type',async()=>{ok(await author.request('/api/v1/cms/blogs/'+blog.id,'PATCH',{status:'PUBLISHED'}));for(const image of [first,second]){const r=await fetch(base+image.url);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/png');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await r.arrayBuffer()),png)}const page=await anon.request('/blog/'+blog.slug);for(const text of ['Rich blog heading','Bold text','Between images'])assert.ok(page.data.includes(text))});
 await test('Unpublishing returns attached pictures to private access',async()=>{ok(await author.request('/api/v1/cms/blogs/'+blog.id,'PATCH',{status:'DRAFT'}));assert.equal((await anon.request(first.url)).status,404);assert.equal((await author.request(first.url)).status,200)});
 await test('Revoking blog permission blocks image uploads in an existing session',async()=>{ok(await admin.request('/api/v1/admin/staff','PATCH',{id:users[0].id,permissions:[]}));assert.equal((await upload(author)).status,403)});
 console.log(passed+' blog image checks passed.');
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(async()=>{try{await db.blogPost.deleteMany({where:{title:{startsWith:marker}}});await db.blogImage.deleteMany({where:{id:{in:imageIds}}});await db.user.deleteMany({where:{email:{startsWith:marker}}});console.log('Removed isolated blog image fixtures.')}finally{await db.$disconnect()}});
