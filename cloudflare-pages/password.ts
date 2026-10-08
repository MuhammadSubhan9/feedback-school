export const hex = (bytes: Uint8Array) => Array.from(bytes, n => n.toString(16).padStart(2, "0")).join("");
export function newSalt() { return hex(crypto.getRandomValues(new Uint8Array(16))); }
export async function deriveVerifier(password: string, saltHex: string) {
  if (!/^[a-f0-9]{32}$/.test(saltHex)) throw new Error("Password setup is unavailable.");
  const salt = Uint8Array.from(saltHex.match(/../g)!, pair => parseInt(pair, 16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 600_000 }, key, 256)));
}
