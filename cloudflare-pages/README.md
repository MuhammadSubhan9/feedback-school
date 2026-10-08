# Cloudflare Pages edition

This folder builds the short student form and private moderation workflow for Cloudflare Pages Free and D1. The Git-integrated production site is [feedback-school.pages.dev](https://feedback-school.pages.dev), deployed from `codex/cloudflare-pages`. The previous Sites deployment remains online.

On 8–9 October 2026, the live site passed a full test: anonymous submission and reference lookup, administrator login, automatic review status, private note, action history, public update, resolution with reason, archive, logout, and direct-route protection. The production test submission was archived. Mobile and desktop layouts showed no horizontal overflow at 320, 375, 390, 430, 768, 1024, 1440, and 1920 pixels. Cloudflare's Pages CPU dashboard had not populated at the time of this test, so monitor it as real traffic arrives.

## Architecture

- Vite builds a static React app; the public page does not call a Worker merely to load.
- Pages advanced-mode `_worker.js` serves API requests and protects direct admin dashboard/detail route requests before serving the app shell.
- D1 holds submissions, internal notes, history, rate counters, administrator credential verifier and short-lived sessions.
- The administrator username is `Admin` (case-insensitive). The password is case-sensitive. The browser derives a salted PBKDF2-SHA-256 verifier with 600,000 iterations; the API stores only an HMAC of that verifier using a separate server-only `PASSWORD_PEPPER`. No raw password or pepper goes in the Git repository or the browser bundle. The verifier is password-equivalent in transit and requires HTTPS.
- A separate, random `OWNER_SETUP_KEY` is required to create or reset the administrator password. Keep it outside Git and outside student-accessible materials.
- The local build and workflow passed under Wrangler's Pages simulator, and the live workflow succeeded on Free. Cloudflare's 10 ms production CPU limit still needs ongoing observation because the dashboard had no data immediately after launch.

## Build and local check

Run `npm ci` with Node 22.13+ and `npm run build:pages`. The output is `cloudflare-pages/dist`. Run Pages dev with the `DB` D1 binding and local-only values for `SITE_ORIGIN`, `FEEDBACK_SECRET`, `PASSWORD_PEPPER`, and `OWNER_SETUP_KEY`. Apply `drizzle/0000_tranquil_whistler.sql` and `drizzle/0001_empty_hiroim.sql` once to the local database. `tests/pages-workflow.mjs` refuses non-loopback targets and covers submission, admin login, status changes, notes, history, resolution, public status, logout, and route protection.

## Production deployment

1. In an existing Cloudflare Free account, create a D1 database named `school-feedback` and apply the two committed SQL migrations in order. Do not import local test data.
2. Create a **Git-integrated** Cloudflare Pages project from [MuhammadSubhan9/feedback-school](https://github.com/MuhammadSubhan9/feedback-school), using production branch `codex/cloudflare-pages`, build command `npm run build:pages`, and output directory `cloudflare-pages/dist`. Use Node 22.13 or newer. Do not create a Direct Upload project if Git integration is wanted later; Cloudflare does not support switching it to Git integration.
3. Under Pages project Settings → Bindings, bind the D1 database as `DB` and redeploy after adding it.
4. Under production environment variables/secrets, set `SITE_ORIGIN` to the exact `https://<project>.pages.dev` origin. Create distinct, cryptographically random values of at least 32 characters for `FEEDBACK_SECRET`, `PASSWORD_PEPPER`, and `OWNER_SETUP_KEY`. Store the three sensitive values as encrypted secrets. Do not commit them or use the local test values.
5. Redeploy, open `/admin/setup` using the owner setup key, and choose a memorable but non-obvious administrator passphrase of at least 15 characters. The only username is `Admin`.
6. Test an anonymous submission, verify the D1 row, sign in, inspect the case, add an internal note, change status and publish a separate public update, resolve with a reason, check the public reference, and sign out. Check Pages Functions error and CPU metrics on the **Free** plan before sharing the new address. Keep the existing site live until this passes.

Cloudflare's [Pages D1 binding guide](https://developers.cloudflare.com/pages/functions/bindings/) and [Git integration guide](https://developers.cloudflare.com/pages/configuration/git-integration/) describe the dashboard steps. Free limits can change; the current [Workers Free pricing](https://developers.cloudflare.com/workers/platform/pricing/) lists 100,000 Function requests/day and 10 ms CPU/request, while [D1 Free pricing](https://developers.cloudflare.com/d1/platform/pricing/) lists 5 million rows read/day, 100,000 rows written/day, and 5 GB storage. Those are quotas, not a guarantee of uninterrupted service under arbitrary traffic.
