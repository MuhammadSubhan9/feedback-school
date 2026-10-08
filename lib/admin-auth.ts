import { scrypt, timingSafeEqual, randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "cloudflare:workers";
import { AppError, database } from "./server";

const lifetime = 8 * 60 * 60 * 1000;
const settings = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
type Credential = { password_hash: string; version: number };
function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 32, settings, (error, key) => error ? reject(error) : resolve(key)));
}
export function validatePassword(password: string) {
  if (password.length < 15 || password.length > 128) throw new AppError(400, "Use 15–128 characters. Three memorable words work well; symbols aren’t required.");
  if (/^(admin|password|school|student|welcome|letmein|123456|qwerty)[\d\s!@#$._-]*$/i.test(password)) throw new AppError(400, "Choose a less predictable password, such as three unrelated words.");
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$32768$8$3$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
async function verify(password: string, hash: string) {
  const parts = hash.split("$");
  if (parts.length !== 6 || parts.slice(0, 4).join("$") !== "scrypt$32768$8$3" || !/^[a-f0-9]{32}$/.test(parts[4]) || !/^[a-f0-9]{64}$/.test(parts[5])) return false;
  return timingSafeEqual(await derive(password, parts[4]), Buffer.from(parts[5], "hex"));
}
export async function credential() {
  return database().prepare("SELECT password_hash,version FROM admin_credentials WHERE username='admin'").first<Credential>();
}
function digest(token: string) { return createHash("sha256").update(token).digest("hex"); }
function local() { const u = new URL(env.SITE_ORIGIN || "https://invalid.local"); return u.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname); }
export function cookieName() { return local() ? "af_admin" : "__Host-af_admin"; }
export function sessionCookie(token: string, clear = false) {
  return `${cookieName()}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : lifetime / 1000}${local() ? "" : "; Secure"}`;
}
export async function sessionIdentity() {
  const token = (await cookies()).get(cookieName())?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await database().prepare("SELECT s.token_hash FROM admin_sessions s JOIN admin_credentials c ON c.username='admin' AND c.version=s.credential_version WHERE s.token_hash=? AND s.expires_at>?").bind(digest(token), Date.now()).first();
  return row ? { userId: "admin", email: "Admin", displayName: "Admin" } : null;
}
export async function login(username: string, password: string) {
  const current = await credential();
  if (!current) throw new AppError(503, "The site owner needs to set the administrator password first.");
  // Derive even for an incorrect username, so the response does not disclose it through a fast path.
  const valid = await verify(password, current.password_hash);
  if (username.trim().toLowerCase() !== "admin" || !valid) throw new AppError(401, "Incorrect username or password.");
  const token = randomBytes(32).toString("hex"), now = Date.now();
  await database().batch([
    database().prepare("DELETE FROM admin_sessions WHERE expires_at<=?").bind(now),
    database().prepare("INSERT INTO admin_sessions(token_hash,credential_version,created_at,expires_at) VALUES(?,?,?,?)").bind(digest(token), current.version, now, now + lifetime)
  ]);
  return sessionCookie(token);
}
export async function logout(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(cookieName() + "="))?.slice(cookieName().length + 1);
  if (token && /^[a-f0-9]{64}$/.test(token)) await database().prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(digest(token)).run();
  return sessionCookie("", true);
}
export async function setPassword(password: string) {
  validatePassword(password);
  const hash = await hashPassword(password), now = Date.now();
  await database().batch([
    database().prepare("INSERT INTO admin_credentials(username,password_hash,version,updated_at) VALUES('admin',?,1,?) ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash,version=version+1,updated_at=excluded.updated_at").bind(hash, now),
    database().prepare("DELETE FROM admin_sessions")
  ]);
}
