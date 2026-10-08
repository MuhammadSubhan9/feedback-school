import assert from "node:assert/strict";

const base = process.env.TEST_ORIGIN || "http://127.0.0.1:8788";
const url = new URL(base);
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("This test only runs against loopback.");
const password = process.env.TEST_ADMIN_PASSWORD;
if (!password) throw new Error("Set TEST_ADMIN_PASSWORD to the local test credential.");
const hex = bytes => Array.from(bytes, n => n.toString(16).padStart(2,"0")).join("");
async function verifier(value, saltHex) {
  const salt = Uint8Array.from(saltHex.match(/../g), pair => parseInt(pair,16));
  const key = await crypto.subtle.importKey("raw",new TextEncoder().encode(value),"PBKDF2",false,["deriveBits"]);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:600_000},key,256)));
}
async function call(path, method = "GET", data, cookie, extra = {}) {
  const response = await fetch(base + path, { method, headers: { ...(method === "GET" ? {} : { Origin: base, "Content-Type": "application/json" }), ...(cookie ? { Cookie: cookie } : {}), ...extra }, body: data === undefined ? undefined : JSON.stringify(data), redirect: "manual" });
  let body = {};
  if (response.headers.get("content-type")?.includes("json")) body = await response.json();
  return { status: response.status, body, headers: response.headers };
}
if (process.env.TEST_OWNER_SETUP_KEY) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const setup = await call("/api/auth/password","POST",{verifier:await verifier(password,salt),salt},undefined,{"x-owner-setup-key":process.env.TEST_OWNER_SETUP_KEY});
  assert.equal(setup.status,200,JSON.stringify(setup.body));
}
const config = await call("/api/auth/config");
assert.equal(config.status,200);
assert.ok(config.body.salt);
const gate = await call("/admin/dashboard");
assert.equal(gate.status, 302);
assert.equal(new URL(gate.headers.get("location")).pathname, "/admin/login");
assert.equal((await call("/api/admin/summary")).status, 401);
const wrong = await call("/api/auth/login", "POST", { username: "Admin", password: await verifier(password.toLowerCase(),config.body.salt) });
assert.equal(wrong.status, 401);
const login = await call("/api/auth/login", "POST", { username: "aDmIn", password: await verifier(password,config.body.salt) });
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie").split(";")[0];
assert.equal((await call("/admin/dashboard", "GET", undefined, cookie)).status, 200);
const ch = await call("/api/feedback/challenge");
assert.equal(ch.status, 200);
await new Promise(resolve => setTimeout(resolve, 1300));
const submission = await call("/api/feedback", "POST", { category: "Suggestion / Idea", subject: "Pages integration test", message: "A local test of the feedback and moderation workflow.", priority: "Normal", location: null, submissionKey: crypto.randomUUID(), challenge: ch.body.challenge, website: "" });
assert.equal(submission.status, 201, JSON.stringify(submission.body));
const ref = submission.body.referenceCode;
assert.match(ref, /^AF-[A-Z2-9]{12}$/);
const list = await call("/api/admin/submissions?search=Pages%20integration%20test", "GET", undefined, cookie);
assert.equal(list.status, 200);
assert.ok(list.body.items.some(item => item.referenceCode === ref));
let detail = await call("/api/admin/submissions/" + ref, "GET", undefined, cookie);
assert.equal(detail.status, 200);
assert.equal(detail.body.submission.status, "New");
assert.equal((await call("/api/admin/submissions/" + ref + "/review", "POST", {}, cookie)).status, 200);
detail = await call("/api/admin/submissions/" + ref, "GET", undefined, cookie);
assert.equal(detail.body.submission.status, "Under Review");
assert.equal((await call("/api/admin/submissions/" + ref + "/notes", "POST", { body: "Local integration note, private to admins." }, cookie)).status, 201);
detail = await call("/api/admin/submissions/" + ref, "GET", undefined, cookie);
assert.equal(detail.body.notes.length, 1);
assert.ok(detail.body.history.some(entry => entry.event === "Internal note added"));
const resolved = await call("/api/admin/submissions/" + ref, "PATCH", { status: "Resolved", flags: [], publicUpdate: "Your suggestion has been reviewed.", reason: "Reviewed in the local integration test.", version: detail.body.submission.version }, cookie);
assert.equal(resolved.status, 200);
const publicStatus = await call("/api/status", "POST", { referenceCode: ref });
assert.equal(publicStatus.status, 200);
assert.equal(publicStatus.body.status, "Resolved");
assert.equal(publicStatus.body.publicUpdate, "Your suggestion has been reviewed.");
assert.equal(JSON.stringify(publicStatus.body).includes("Local integration note"), false);
detail = await call("/api/admin/submissions/" + ref, "GET", undefined, cookie);
assert.ok(detail.body.history.some(entry => entry.event.startsWith("Status changed to Resolved")));
assert.equal((await call("/api/auth/logout", "POST", {}, cookie)).status, 200);
assert.equal((await call("/api/admin/summary", "GET", undefined, cookie)).status, 401);
console.log("Cloudflare Pages local workflow passed:", ref);
