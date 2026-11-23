import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { staffDisplayName } from "../src/lib/staff-display";

const db = new PrismaClient();
const marker = `qa-designation-${randomUUID()}`;
const base = process.env.STAFF_TEST_BASE || "http://localhost:3000";
async function main() {
  for (const url of [process.env.DATABASE_URL!, base]) assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname), "Run against local test services only.");
  const admin = await db.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN", isActive: true } });
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  assert.ok(secret);
  async function cookie(user: { id: string; email: string; role: string }) {
    return `authjs.session-token=${await encode({ token: { sub: user.id, id: user.id, email: user.email, role: user.role }, secret: secret!, salt: "authjs.session-token", maxAge: 600 })}`;
  }
  const adminCookie = await cookie(admin);
  async function send(method: string, body?: object, session = adminCookie) {
    const response = await fetch(`${base}/api/v1/admin/staff`, { method, headers: { "Content-Type": "application/json", ...(session ? { Cookie: session } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  try {
    assert.equal((await send("POST", { name: marker }, "")).status, 403);
    const create = await send("POST", { name: marker, userId: `${marker}@example.com`, password: randomUUID(), permissions: ["blogs", "colleges"], designation: "  Admissions Counsellor  " });
    assert.equal(create.status, 201);
    const staff = create.data.staff;
    assert.equal(staff.designation, "Admissions Counsellor");
    assert.ok(!Object.hasOwn(staff, "passwordHash"));
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: staff.id } })).designation, "Admissions Counsellor");
    const staffCookie = await cookie({ ...staff, role: "STAFF" });
    const session = async () => (await (await fetch(`${base}/api/auth/session`, { headers: { Cookie: staffCookie } })).json()).user;
    assert.equal((await session()).designation, "Admissions Counsellor");
    assert.equal((await send("PATCH", { id: staff.id, designation: "Changed by staff" }, staffCookie)).status, 403);
    assert.equal((await send("PATCH", { id: admin.id, designation: "Wrong target" })).status, 404);
    for (const designation of [42, "x".repeat(121), "First\nSecond"]) assert.equal((await send("PATCH", { id: staff.id, designation })).status, 400);
    assert.equal((await session()).designation, "Admissions Counsellor");
    assert.equal((await send("PATCH", { id: staff.id, designation: "Super Administrator", role: "SUPER_ADMIN" })).status, 200);
    const after = await session();
    assert.equal(after.designation, "Super Administrator");
    assert.equal(after.role, "STAFF", "A display designation cannot grant a privileged role.");
    assert.equal((await send("GET", undefined, staffCookie)).status, 403);
    assert.equal((await send("PATCH", { id: staff.id, permissions: ["blogs", "colleges"] })).status, 200);
    assert.equal((await session()).designation, "Super Administrator", "Omitting the field preserves the saved title.");
    assert.equal((await send("PATCH", { id: staff.id, designation: "  " })).status, 200);
    assert.equal((await session()).designation, null);
    assert.equal((await send("PATCH", { id: staff.id, designation: null })).status, 200);
    await send("PATCH", { id: staff.id, designation: "Senior College Advisor" });
    const list = await send("GET");
    assert.equal(list.data.staff.find((row: { id: string }) => row.id === staff.id).designation, "Senior College Advisor");
    assert.deepEqual((await db.staffPermission.findUniqueOrThrow({ where: { userId: staff.id } })).permissions, ["blogs", "colleges"]);
    const legacy = await send("POST", { name: marker + " legacy", userId: `${marker}-legacy@example.com`, password: randomUUID(), permissions: ["blogs"] });
    assert.equal(legacy.status, 201);
    assert.equal(legacy.data.staff.designation, null, "Existing clients can create staff without a designation.");
    assert.equal(staffDisplayName({ name: "Editor", designation: "Content Editor" }), "Editor · Content Editor");
    assert.equal(staffDisplayName({ name: "Editor", designation: null }), "Editor");
    console.log("Staff designation API checks passed: create, update, clear, validation, authorization, live sessions, role separation, preserved permissions and legacy clients.");
  } finally { await db.user.deleteMany({ where: { email: { startsWith: marker }, role: "STAFF" } }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
