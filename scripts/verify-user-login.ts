import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { authAttemptKey, consumeAuthAttempt } from "../src/lib/auth/throttle";
import { registrationSchema } from "../src/lib/auth/account-validation";
import { portalDestination } from "../src/lib/portal-navigation";

const db = new PrismaClient();
const marker = `qa-user-login-${randomUUID()}`;
const base = process.env.USER_LOGIN_TEST_BASE || "http://localhost:3000";
const addresses = ["198.51.100.71", "198.51.100.72", "198.51.100.73", "198.51.100.74"];
const keys = new Set<string>();
class Client {
  cookies = new Map<string, string>();
  constructor(readonly address = addresses[0]) {}
  async request(path: string, method = "GET", body?: object | URLSearchParams, extra: Record<string, string> = {}) {
    const response = await fetch(base + path, { method, redirect: "manual", headers: { Cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; "), "x-real-ip": this.address, Origin: base, ...(body ? { "Content-Type": body instanceof URLSearchParams ? "application/x-www-form-urlencoded" : "application/json" } : {}), ...extra }, ...(body ? { body: body instanceof URLSearchParams ? body : JSON.stringify(body) } : {}) });
    for (const item of response.headers.getSetCookie()) {
      const pair = item.split(";")[0], position = pair.indexOf("="), name = pair.slice(0, position), value = pair.slice(position + 1);
      if (value) this.cookies.set(name, value); else this.cookies.delete(name);
    }
    const text = await response.text(); let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, data, headers: response.headers };
  }
  async login(email: string, password: string) {
    keys.add(authAttemptKey("login-ip", this.address)); keys.add(authAttemptKey("login-account", `${this.address}:${email.trim().toLowerCase()}`));
    const csrf = await this.request("/api/auth/csrf");
    const response = await this.request("/api/auth/callback/credentials", "POST", new URLSearchParams({ csrfToken: csrf.data.csrfToken, email, password, callbackUrl: base + "/student" }), { "X-Auth-Return-Redirect": "1" });
    const session = await this.request("/api/auth/session");
    return { ...response, user: session.data?.user };
  }
}
async function main() {
  for (const value of [process.env.DATABASE_URL!, base]) assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname), "Use local test services only.");
  const password = `Private-${randomUUID()}`;
  const email = `${marker}@example.com`;
  const account = { name: marker, email, password };
  const visitor = new Client();
  addresses.forEach(address => keys.add(authAttemptKey("register-ip", address)));
  const concurrencyKey = authAttemptKey(marker, "concurrent"); keys.add(concurrencyKey);
  try {
    assert.equal(registrationSchema.safeParse({ ...account, role: "SUPER_ADMIN" }).success, false);
    assert.equal(registrationSchema.safeParse({ ...account, password: "🙂".repeat(20) }).success, false);
    assert.equal(portalDestination("STUDENT", null, "/\t/evil.example"), "/student");
    assert.equal(portalDestination("STUDENT", null, "https://evil.example"), "/student");
    assert.equal(portalDestination("STUDENT", null, "/admin/users"), "/student");
    assert.equal(portalDestination("STUDENT", null, "/register"), "/student");
    assert.equal(portalDestination("STUDENT", null, "/blog/guide?ref=account#details"), "/blog/guide?ref=account#details");
    const attempts = await Promise.all(Array.from({ length: 8 }, () => consumeAuthAttempt(marker, "concurrent", 3, 60000)));
    assert.equal(attempts.filter(result => result.allowed).length, 3, "Concurrent instances share an atomic limit.");
    await db.authThrottle.update({ where: { key: concurrencyKey }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await consumeAuthAttempt(marker, "concurrent", 3, 60000)).allowed, true);
    for (const bad of [{ ...account, role: "SUPER_ADMIN" }, { ...account, permissions: ["users"] }, { ...account, password: "short" }, { ...account, email: "invalid" }]) assert.equal((await visitor.request("/api/v1/auth/register", "POST", bad)).status, 400);
    assert.equal((await visitor.request("/api/v1/auth/register", "POST", account, { "Sec-Fetch-Site": "cross-site" })).status, 403);
    assert.equal((await visitor.request("/api/v1/auth/register", "POST", { ...account, name: "a".repeat(9000) })).status, 413);
    const created = await visitor.request("/api/v1/auth/register", "POST", { ...account, email: ` ${email.toUpperCase()} ` });
    assert.equal(created.status, 201, JSON.stringify(created.data)); assert.deepEqual(created.data, { success: true }); assert.match(created.headers.get("cache-control") || "", /no-store/);
    const saved = await db.user.findUniqueOrThrow({ where: { email } });
    assert.equal(saved.role, "STUDENT"); assert.equal(saved.designation, null); assert.ok(saved.passwordHash && saved.passwordHash !== password); assert.equal(await bcrypt.compare(password, saved.passwordHash!), true);
    assert.equal(await db.staffPermission.count({ where: { userId: saved.id } }), 0);
    assert.equal((await visitor.request("/api/v1/auth/register", "POST", account)).status, 409);
    assert.equal((await db.user.findUniqueOrThrow({ where: { email } })).passwordHash, saved.passwordHash);
    assert.equal((await visitor.request("/api/v1/student")).status, 401);
    assert.equal((await visitor.login(email, "wrong-password")).user, undefined);
    const signedIn = await visitor.login(` ${email.toUpperCase()} `, password);
    assert.equal(signedIn.user.role, "STUDENT"); assert.equal(signedIn.user.id, saved.id);
    assert.ok(!Object.hasOwn(signedIn.user, "passwordHash"));
    assert.match(signedIn.headers.getSetCookie().join(";"), /HttpOnly/i);
    const portal = await visitor.request("/api/v1/student"); assert.equal(portal.status, 200); assert.equal(portal.data.profile.id, saved.id); assert.match(portal.headers.get("cache-control") || "", /private.*no-store/);
    assert.equal((await visitor.request("/api/v1/admin/staff")).status, 403);
    const adminPage = await visitor.request("/admin"); assert.equal(adminPage.status, 307); assert.ok((adminPage.headers.get("location") || "").endsWith("/student"));
    assert.equal((await visitor.request("/api/v1/auth/register", "POST", { ...account, email: `${marker}-other@example.com` })).status, 409);
    const csrf = await visitor.request("/api/auth/csrf"); await visitor.request("/api/auth/signout", "POST", new URLSearchParams({ csrfToken: csrf.data.csrfToken, callbackUrl: base + "/login" }));
    assert.equal((await visitor.request("/api/auth/session")).data?.user, undefined); assert.equal((await visitor.request("/api/v1/student")).status, 401);
    for (const role of ["STAFF", "SUPER_ADMIN"] as const) {
      const user = await db.user.create({ data: { name: marker + role, email: `${marker}-${role.toLowerCase()}@example.com`, passwordHash: saved.passwordHash, role, ...(role === "STAFF" ? { designation: "Admissions Counsellor", staffPermission: { create: { permissions: ["blogs"] } } } : {}) } });
      const client = new Client(addresses[1]); const login = await client.login(user.email, password); assert.equal(login.user.role, role); if (role === "STAFF") assert.equal(login.user.designation, "Admissions Counsellor");
      await db.user.update({ where: { id: user.id }, data: { isActive: false } }); assert.equal((await client.request("/api/auth/session")).data?.user, undefined);
    }
    const throttled = new Client(addresses[2]); let last;
    for (let attempt = 0; attempt < 16; attempt++) last = await throttled.login(email, "wrong-password");
    assert.equal(new URL(last!.data.url).searchParams.get("code"), "rate_limited");
    assert.equal((await throttled.login(email, password)).user, undefined);
    assert.equal((await new Client(addresses[3]).login(email, password)).user.role, "STUDENT");
    const registrationLimit = new Client(addresses[3]);
    for (let attempt = 0; attempt < 10; attempt++) assert.equal((await registrationLimit.request("/api/v1/auth/register", "POST", account)).status, 409);
    const blocked = await registrationLimit.request("/api/v1/auth/register", "POST", account); assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get("retry-after")) > 0);
    console.log("User login checks passed: validation, normalized/duplicate emails, password hashing, sign-in/out, private sessions, student/admin/staff separation, deactivated accounts, safe redirects, cross-site rejection, bounded registration, and persistent atomic attempt limits.");
  } finally {
    await db.user.deleteMany({ where: { email: { startsWith: marker } } });
    await db.authThrottle.deleteMany({ where: { key: { in: [...keys] } } });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
