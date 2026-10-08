import { handle } from "./api/api";
import { sessionIdentity, credential } from "./api/admin-auth";
import { json } from "./api/server";

interface PagesEnv extends Cloudflare.Env { ASSETS: { fetch(request: Request): Promise<Response> } }
export default {
  async fetch(request: Request, env: PagesEnv): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    let response: Response;
    if (pathname === "/api/auth/session" && request.method === "GET") {
      const identity = await sessionIdentity(request);
      response = json({ signedIn: !!identity });
    } else if (pathname === "/api/auth/config" && request.method === "GET") {
      const current = await credential();
      response = json({ configured: !!current, salt: current?.password_hash.split("$")[1] || null });
    } else if (pathname.startsWith("/api/")) {
      response = await handle(request);
    } else if (pathname.startsWith("/admin/dashboard") || pathname.startsWith("/admin/submissions/")) {
      if (!await sessionIdentity(request)) return Response.redirect(new URL("/admin/login", request.url), 302);
      response = await env.ASSETS.fetch(new Request(new URL("/", request.url), request));
    } else if (pathname === "/" || pathname === "/admin/login" || pathname === "/admin/setup") {
      response = await env.ASSETS.fetch(new Request(new URL("/", request.url), request));
    } else {
      response = await env.ASSETS.fetch(request);
    }
    const secured = new Response(response.body, response);
    secured.headers.set("X-Content-Type-Options", "nosniff");
    secured.headers.set("Referrer-Policy", "no-referrer");
    secured.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    secured.headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    if (new URL(request.url).protocol === "https:") secured.headers.set("Strict-Transport-Security", "max-age=31536000");
    if (/^\/(admin|api)(\/|$)/.test(pathname)) secured.headers.set("Cache-Control", "no-store, private");
    return secured;
  }
};
