import { env } from "cloudflare:workers";
import { AppError, database } from "./server";

const lifetime = 8 * 60 * 60 * 1000;
type Credential = { password_hash: string; version: number };
const hex = (bytes: Uint8Array) => Array.from(bytes, n => n.toString(16).padStart(2, "0")).join("");
const unhex = (value: string) => Uint8Array.from(value.match(/../g) || [], pair => parseInt(pair, 16));
async function keyedPassword(verifier: string, salt: Uint8Array) {
  if (!env.PASSWORD_PEPPER || env.PASSWORD_PEPPER.length < 32) throw new AppError(503, "Administrator access is not configured.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.PASSWORD_PEPPER), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const input = new Uint8Array(salt.length + 1 + unhex(verifier).length);
  input.set(salt);
  input.set(unhex(verifier), salt.length + 1);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, input));
}
async function digest(value: string) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))); }
async function hashPassword(verifier: string, saltHex: string) {
  if (!/^[a-f0-9]{64}$/.test(verifier) || !/^[a-f0-9]{32}$/.test(saltHex)) throw new AppError(400, "Invalid password verifier.");
  return `client-pbkdf2-600000$${saltHex}$${hex(await keyedPassword(verifier, unhex(saltHex)))}`;
}
async function verify(verifier: string, hash: string) {
  const parts = hash.split("$");
  if (parts.length !== 3 || parts[0] !== "client-pbkdf2-600000" || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2]) || !/^[a-f0-9]{64}$/.test(verifier)) return false;
  const actual = await keyedPassword(verifier, unhex(parts[1]));
  const expected = unhex(parts[2]);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ expected[i];
  return difference === 0;
}
export async function credential() { return database().prepare("SELECT password_hash,version FROM admin_credentials WHERE username='admin'").first<Credential>(); }
function local() { const u = new URL(env.SITE_ORIGIN || "https://invalid.local"); return u.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname); }
export function cookieName() { return local() ? "af_admin" : "__Host-af_admin"; }
export function sessionCookie(token: string, clear = false) { return `${cookieName()}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : lifetime / 1000}${local() ? "" : "; Secure"}`; }
export async function sessionIdentity(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(cookieName() + "="))?.slice(cookieName().length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await database().prepare("SELECT s.token_hash FROM admin_sessions s JOIN admin_credentials c ON c.username='admin' AND c.version=s.credential_version WHERE s.token_hash=? AND s.expires_at>?").bind(await digest(token), Date.now()).first();
  return row ? { userId: "admin", email: "Admin", displayName: "Admin" } : null;
}
export async function login(username: string, verifier: string) {
  const current = await credential();
  if (!current) throw new AppError(503, "The site owner needs to set the administrator password first.");
  const valid = await verify(verifier, current.password_hash);
  if (username.trim().toLowerCase() !== "admin" || !valid) throw new AppError(401, "Incorrect username or password.");
  const token = hex(crypto.getRandomValues(new Uint8Array(32))), now = Date.now();
  await database().batch([
    database().prepare("DELETE FROM admin_sessions WHERE expires_at<=?").bind(now),
    database().prepare("INSERT INTO admin_sessions(token_hash,credential_version,created_at,expires_at) VALUES(?,?,?,?)").bind(await digest(token), current.version, now, now + lifetime)
  ]);
  return sessionCookie(token);
}
export async function logout(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(cookieName() + "="))?.slice(cookieName().length + 1);
  if (token && /^[a-f0-9]{64}$/.test(token)) await database().prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(await digest(token)).run();
  return sessionCookie("", true);
}
export async function setPassword(verifier: string, salt: string) {
  const hash = await hashPassword(verifier, salt), now = Date.now();
  await database().batch([
    database().prepare("INSERT INTO admin_credentials(username,password_hash,version,updated_at) VALUES('admin',?,1,?) ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash,version=version+1,updated_at=excluded.updated_at").bind(hash, now),
    database().prepare("DELETE FROM admin_sessions")
  ]);
}
