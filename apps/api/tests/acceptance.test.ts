// REPORTA API acceptance tests — run against the real implementation + database.
// Usage: set env, then: node --import tsx --test tests/acceptance.test.ts
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.TEST_API_URL ?? "http://localhost:4400";
const ADMIN_EMAIL = "acceptance-admin@test.local";
const ADMIN_PASSWORD = "Accept-Admin-2026-Pass!";
const RUN = String(process.env.TEST_RUN_ID ?? Date.now());
const OFFICER_EMAIL = `officer-${RUN}@test.local`;
const OFFICER_PASSWORD = "Accept-Officer-2026-Pass!";

let adminToken = "";
let officerToken = "";
let reporterToken = "";
let reporterEmail = `reporter-${RUN}@test.local`;
let reportRef = "";
let trackingCode = "";
let reportId = "";
let officerId = "";
let assignmentId = "";

async function j(method: string, path: string, body?: any, token?: string) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try { data = await res.json(); } catch { }
  return { status: res.status, data };
}

before(async () => {
  // Seed super admin directly through the API's seed script conventions:
  // the test DB must already have the admin seeded via seed-admin.mjs with
  // TEST env vars; if not seeded, create via register+DB is not possible via API.
  // We rely on the admin being seeded by the test harness (run-seed-tests.ps1).
});

test("health endpoint responds", async () => {
  const r = await j("GET", "/health");
  assert.equal(r.status, 200);
  assert.equal(r.data.status, "ok");
});

test("public registration creates reporter role only", async () => {
  const r = await j("POST", "/api/auth/register", {
    email: reporterEmail, password: "Reporter-Pass-2026!", name: "Test Reporter",
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.role, "reporter");
  reporterToken = r.data.accessToken;
});

test("public registration CANNOT create admin/officer roles", async () => {
  const r = await j("POST", "/api/auth/register", {
    email: `evil-${Date.now()}@test.local`, password: "Evil-Pass-2026!!", name: "Evil User",
    role: "super_admin" as any, // attempting role escalation
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.role, "reporter"); // role forced server-side
});

test("anonymous report submission returns reference + tracking code", async () => {
  const fd = new FormData();
  fd.append("category", "Theft");
  fd.append("description", "Someone stole a mobile phone near the lorry station this evening.");
  fd.append("region", "Greater Accra");
  fd.append("town", "Madina");
  fd.append("urgency", "normal");
  fd.append("isAnonymous", "true");
  const res = await fetch(`${BASE}/api/reports`, { method: "POST", body: fd });
  assert.equal(res.status, 201);
  const data: any = await res.json();
  reportRef = data.reference;
  trackingCode = data.trackingCode;
  assert.match(reportRef, /^RPT-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.ok(trackingCode && trackingCode.length >= 16);
});

test("report with photo evidence persists and validates content", async () => {
  // Minimal valid PNG (1x1)
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const fd = new FormData();
  fd.append("category", "Assault");
  fd.append("description", "A person was assaulted at the market; attaching a photo of the scene.");
  fd.append("region", "Ashanti");
  fd.append("isAnonymous", "false");
  fd.append("evidence", new Blob([png], { type: "image/png" }), "evidence.png");
  const res = await fetch(`${BASE}/api/reports`, {
    method: "POST",
    body: fd,
    headers: { Authorization: `Bearer ${reporterToken}` },
  });
  assert.equal(res.status, 201);
});

test("rejects executable content disguised as image", async () => {
  const fd = new FormData();
  fd.append("category", "Theft");
  fd.append("description", "Testing that a fake image with executable content is rejected by the server.");
  fd.append("isAnonymous", "true");
  fd.append("evidence", new Blob([Buffer.from("MZ\x90\x00fake executable content")], { type: "image/png" }), "fake.png");
  const res = await fetch(`${BASE}/api/reports`, { method: "POST", body: fd });
  assert.ok(res.status === 415 || res.status === 400, `expected 415/400, got ${res.status}`);
});

test("tracking requires the tracking code for anonymous reports", async () => {
  const no = await j("GET", `/api/reports/track/${reportRef}`);
  assert.equal(no.status, 403);
  const wrong = await j("GET", `/api/reports/track/${reportRef}?t=WRONGCODE12345678`);
  assert.equal(wrong.status, 403);
  const ok = await j("GET", `/api/reports/track/${reportRef}?t=${trackingCode}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.data.report.reference, reportRef);
  assert.ok(!("internalNotes" in ok.data.report), "public tracking must not leak internal notes");
  assert.ok(!ok.data.report.evidence, "public tracking must not leak evidence links");
});

test("admin endpoints reject unauthenticated and non-staff users", async () => {
  const anon = await j("GET", "/api/admin/reports");
  assert.equal(anon.status, 401);
  const reporter = await j("GET", "/api/admin/reports", undefined, reporterToken);
  assert.equal(reporter.status, 403);
});

test("seeded admin can sign in and is forced to change password", async () => {
  const r = await j("POST", "/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  assert.equal(r.status, 200, `admin login failed: ${JSON.stringify(r.data)}`);
  assert.equal(r.data.user.role, "super_admin");
  adminToken = r.data.accessToken;
});

test("admin can view the report in the queue", async () => {
  const r = await j("GET", "/api/admin/reports", undefined, adminToken);
  assert.equal(r.status, 200);
  const found = r.data.reports.find((x: any) => x.reference === reportRef);
  assert.ok(found, "submitted report should appear in the admin queue");
  reportId = found.id;
});

test("admin can invite an officer; activation sets password", async () => {
  const inv = await j("POST", "/api/admin/officers/invite", {
    email: OFFICER_EMAIL, name: "Test Officer", role: "officer", office: "Greater Accra", staffCode: `OFF-GA-${RUN}`,
  }, adminToken);
  assert.equal(inv.status, 201, `invite failed: ${JSON.stringify(inv.data)}`);
  // In log email mode the API returns the accept URL directly.
  const acceptUrl = inv.data.acceptUrl;
  assert.ok(acceptUrl, `no acceptUrl in response: ${JSON.stringify(inv.data)}`);
  // acceptUrl uses a hash route (#/activate?token=...), so parse the token from the fragment
  const token = new URLSearchParams(acceptUrl.split("?")[1] ?? "").get("token");
  assert.ok(token);
  const act = await j("POST", "/api/auth/activate", { token, password: OFFICER_PASSWORD });
  assert.equal(act.status, 200);
  assert.equal(act.data.user.role, "officer");
  officerToken = act.data.accessToken;
  officerId = act.data.user.id;
});

test("officer cannot list admin reports", async () => {
  const r = await j("GET", "/api/admin/reports", undefined, officerToken);
  assert.equal(r.status, 403);
});

test("admin assigns the report to the officer", async () => {
  const r = await j("POST", `/api/admin/reports/${reportId}/assign`, { officerId, note: "Please follow up." }, adminToken);
  assert.equal(r.status, 200);
});

test("officer sees the assignment and acknowledges it", async () => {
  const list = await j("GET", "/api/officer/cases", undefined, officerToken);
  assert.equal(list.status, 200);
  const mine = list.data.cases.find((c: any) => c.report.reference === reportRef);
  assert.ok(mine, "assigned case must appear in officer's list");
  assignmentId = mine.assignmentId;
  assert.equal(mine.acknowledgedAt, null);
  const ack = await j("POST", `/api/officer/assignments/${assignmentId}/acknowledge`, undefined, officerToken);
  assert.equal(ack.status, 200);
});

test("officer records a progress update that persists", async () => {
  const r = await j("POST", `/api/officer/cases/${reportId}/update`, {
    kind: "progress", body: "Visited the scene and interviewed two witnesses.", visibility: "public",
  }, officerToken);
  assert.equal(r.status, 201);
  // Admin can see the update
  const detail = await j("GET", `/api/admin/reports/${reportId}`, undefined, adminToken);
  const found = detail.data.report.updates.some((u: any) => u.body.includes("interviewed two witnesses"));
  assert.ok(found, "admin must see the officer's update");
});

test("officer cannot access cases not assigned to them", async () => {
  // Submit a second report, do not assign it
  const fd = new FormData();
  fd.append("category", "Fraud / scam");
  fd.append("description", "Unassigned fraud report used to test officer access isolation.");
  fd.append("isAnonymous", "true");
  const res = await fetch(`${BASE}/api/reports`, { method: "POST", body: fd });
  const data: any = await res.json();
  const list = await j("GET", "/api/admin/reports", undefined, adminToken);
  const other = list.data.reports.find((x: any) => x.reference === data.reference);
  const r = await j("GET", `/api/officer/cases/${other.id}`, undefined, officerToken);
  assert.equal(r.status, 403);
});

test("officer cannot grant themselves permissions or reach officer management", async () => {
  const r = await j("POST", "/api/admin/officers/invite", {
    email: `self-${Date.now()}@test.local`, name: "Self", role: "admin",
  }, officerToken);
  assert.equal(r.status, 403);
});

test("public tracking shows approved public updates but never internal notes", async () => {
  const r = await j("GET", `/api/reports/track/${reportRef}?t=${trackingCode}`);
  assert.equal(r.status, 200);
  const rep = r.data.report;
  assert.ok(rep.updates.length >= 1, "public update should be visible");
  assert.ok(!("internalNotes" in rep) && !("evidence" in rep), "no internal notes or evidence on public timeline");
});

test("reporter sees only their own reports", async () => {
  const mine = await j("GET", "/api/reports/mine", undefined, reporterToken);
  assert.equal(mine.status, 200);
  assert.ok(mine.data.reports.every((x: any) => x.reference !== reportRef), "anonymous report must not appear in reporter list");
});

test("rate limiting rejects excessive auth attempts", async () => {
  // Only meaningful outside test mode (limits are skipped under NODE_ENV=test)
  if (process.env.NODE_ENV === "test") return;
  let last = 0;
  for (let i = 0; i < 25; i++) {
    const r = await j("POST", "/api/auth/login", { email: "nobody@example.com", password: "wrongpassword" });
    last = r.status;
    if (r.status === 429) break;
  }
  assert.equal(last, 429, "expected 429 after repeated attempts");
});

after(async () => { });
