const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => { if (!(name in dependencies)) throw Error(name); return dependencies[name]; }, Request, Response, File, FormData, Uint8Array, Buffer, URL });
  return exports;
}
const NextResponse = class extends Response { static json(data, init) { return new Response(JSON.stringify(data), init); } };
(async () => {
  let allowed = true, feature, writes = 0;
  const upload = load('src/app/api/v1/cms/blog-images/route.ts', {
    'next/server': { NextResponse },
    '@/lib/auth/staff-guard': { checkAdminAccess: async value => { feature = value; return { allowed, userId: 'uploader' }; } },
    '@/lib/db': { db: { blogImage: { create: async () => { writes++; return { id: 'image-id' }; } } } },
  });
  async function send(bytes, type = 'image/png', purpose = 'colleges') {
    const body = new FormData(); body.append('file', new File([bytes], 'image.png', { type }));
    return upload.POST(new Request(`https://example.com/api/v1/cms/blog-images?purpose=${purpose}`, { method: 'POST', body }));
  }
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jKZkAAAAASUVORK5CYII=', 'base64');
  assert.equal((await send(png)).status, 201); assert.equal(feature, 'colleges');
  assert.equal((await send(png, 'image/png', 'blogs')).status, 201); assert.equal(feature, 'blogs');
  allowed = false; assert.equal((await send(png)).status, 403); allowed = true;
  assert.equal((await send(png, 'image/jpeg')).status, 400);
  assert.equal((await send(Buffer.from('<svg/>'), 'image/svg+xml')).status, 400);
  assert.equal((await send(Buffer.alloc(3 * 1024 * 1024 + 1))).status, 413);
  const boundary = Buffer.alloc(3 * 1024 * 1024); png.copy(boundary);
  assert.equal((await send(boundary)).status, 201, "Exactly 3 MB is allowed");
  assert.equal(writes, 3);
  let publicBlog = false, publicCollege = false, owner = false;
  const read = load('src/app/api/v1/blog-images/[id]/route.ts', {
    'next/server': { NextResponse }, zod: require('zod'),
    '@/lib/auth/staff-guard': { checkAdminAccess: async () => ({ allowed: owner, userId: 'uploader', isSuperAdmin: false }) },
    '@/lib/db': { db: {
      blogImage: { findUnique: async ({ select }) => select.data ? { data: png } : { mimeType: 'image/png', size: png.length, uploaderId: 'uploader' } },
      blogPost: { findFirst: async () => publicBlog ? { id: 'post' } : null },
      college: { findFirst: async ({ where }) => { assert.ok(where.OR.some(condition => condition.placements?.some?.photoUrls?.has), "Published placement photos must be included in image visibility"); return publicCollege ? { id: 'college' } : null; } },
    } },
  });
  const get = () => read.GET(new Request('https://example.com'), { params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000001' }) });
  assert.equal((await get()).status, 404);
  owner = true; assert.equal((await get()).status, 200); owner = false;
  publicCollege = true; assert.equal((await get()).status, 200); publicCollege = false;
  publicBlog = true; const image = await get(); assert.equal(image.status, 200); assert.equal(image.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
  console.log('Image route checks passed: permissions, valid uploads, invalid files, 3 MB boundary, placement image visibility, private access and public college/blog images.');
})().catch(error => { console.error(error); process.exitCode = 1; });
