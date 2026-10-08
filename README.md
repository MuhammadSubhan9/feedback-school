# Anonymous Student Feedback

One public feedback page and a separate protected administrator workspace. No student accounts, council pages, profiles, events pages or news.

## Stack and storage

React 19 / Vinext, Cloudflare Workers, D1 SQLite, generated Drizzle migrations, Zod validation, Radix/Shadcn accessible controls. Real submissions, notes and history live in D1; browser storage is not the database. All administrator authorization runs on the server.

## Run locally

Use Node 22.13+ and npm. On Windows ARM, use an x64 Node runtime: the Workers emulator requires it. A task-local x64 runtime is available under ignored `.sites-runtime/node-x64/node.exe` in this checkout.

1. `npm ci`
2. Copy `.env.example` to `.env` and `.dev.vars`. Set a random `FEEDBACK_SECRET` of at least 32 characters. The two files must have matching application values.
3. Use `ADMIN_EMAILS=seedy@sites.test` only for local development. This account verifies the owner for password setup/recovery; it does not grant dashboard access. The starter simulates that identity on loopback; the hosted service verifies the real owner.
4. `npm run build`
5. Apply each pending `drizzle/*.sql` migration once with `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file <migration>`.
6. `npm run dev`; open the printed URL (normally `http://127.0.0.1:5173`).

Admin login is `/admin/login`: username `Admin` is case-insensitive; the password is case-sensitive. Set the password privately at `/admin/setup`, where the existing provider verifies the site owner. That owner verification is also the recovery mechanism; everyday dashboard sign-in requires only the username and password. The public form contains no admin navigation.

Passwords must be 15–128 characters; symbols and numbers are optional. Obvious passwords such as a school keyword plus a year are rejected. The server stores only a salted scrypt hash (N=32768, r=8, p=3), in the private `admin_credentials` table. No raw passwords or hashes are sent to browser code, committed to the repository, or written to logs. Password hashes are deliberately expensive to verify, rather than plain SHA-256 hashes. HTTPS protects password transport; verify hosting TLS in production.

Successful login creates an unpredictable, eight-hour server session. Only a SHA-256 digest of the random session token is stored in `admin_sessions`; that hash is suitable for a high-entropy token, not a human password. The cookie is HttpOnly, SameSite=Strict and Secure with the `__Host-` prefix on HTTPS. Only loopback development uses a non-Secure cookie. Logout deletes the session server-side, so replaying an old cookie fails. Resetting the password atomically increments its version and revokes all administrator sessions. Unauthorized pages redirect; API endpoints independently require a valid, unexpired session. Login attempts are limited to eight per 15 minutes per keyed network, before password hashing. Every auth write requires the exact same origin.

This is one shared administrator account, as requested. Its actions are attributed internally to `Admin`; sharing its password means individual administrators cannot be distinguished. Use separate accounts if multiple-person attribution is needed later.

## Production configuration

Runtime values are stored in Sites, never the hosting manifest or source:

- `ADMIN_EMAILS`: owner identity allowed to set/reset the admin password, verified by ChatGPT. An empty allowlist disables setup/recovery. Only the owner's address is configured. This variable never grants access to the dashboard by itself.
- `FEEDBACK_SECRET`: cryptographically random secret for signed anti-spam challenges and keyed rate counters; mark as secret.
- `SITE_ORIGIN`: exact production HTTPS origin for CSRF checks, without a trailing slash.

`.openai/hosting.json` declares the `DB` binding. Sites provisions the production database and applies committed migrations during deployment. The local test database, credential fixture and sessions are separate and never packaged. Keep applied migrations immutable; generate a new migration for changes. On the first hosted visit, the verified owner sets a password at `/admin/setup`. There is no default production password, and unauthenticated visitors cannot claim the account. Recovery requires the configured owner's verified account.

## Privacy and security boundaries

Submissions store category, subject, message, priority, optional location, random reference, workflow fields and timestamps. They store no student name, email, account identity, class, ID, IP, user agent or referrer. Server validation rejects extra identity fields. Administrator identities appear only in private notes/history.

IP addresses are used transiently to generate HMAC rate-counter keys, scoped to endpoint and ten-minute window. Raw IPs are never stored in D1, and keys are not stored with submissions. Counter rows expire and are removed on subsequent traffic. Reverse proxies, the hosting provider and school networks may still process request metadata; this is not a guarantee of absolute anonymity. Students can also identify themselves in message text; the UI asks them to leave personal details out.

Public reference codes use 60 random bits (12 unambiguous characters) rather than an enumerable five-character code. Anyone holding the code can see only the current public status, an explicitly published public update and last-updated date. Reference requests use POST so codes are not added to URL history. Codes cannot recover private details or notes. Public pages have no tracking scripts or external fonts.

Writes require same-origin JSON; request bodies are bounded; inputs are checked server-side; database queries are parameterized; React escapes submitted content. Responses include CSP, no-referrer policy, nosniff and restricted device permissions; private pages/APIs disable caching. The production Worker enables HSTS over HTTPS. Signed short-lived anti-spam challenges are consumed atomically with the submission; honeypots and database-backed rate limits supplement them. Retry keys prevent duplicate submissions after a dropped connection. Rate limits allow shared school networks (120 submissions per ten minutes per keyed network); adjust limits in `lib/api.ts` after observing real traffic. Public reference probing is restricted separately.

Conflicting status updates reject stale versions. Changes and history entries are written in atomic D1 batches. Closing statuses require an internal reason. Flags are independent of statuses. Notes are in a separate table. Public updates are separate from internal notes/reasons. Archiving retains feedback, notes, history and public status; restoring is supported. There is no permanent-delete endpoint. Bulk actions are limited to 20 records, skip records changed by another administrator, and report skipped counts.

Urgent feedback includes a reminder to seek immediate help in emergencies; this system does not promise continuous monitoring. Before a school-wide rollout, the school needs an assigned reviewing team, retention/backups policy, and incident-response process. These operational policies cannot be supplied by an application alone.

## Verification

`node tests/workflow.mjs` refuses non-loopback origins. It verifies owner-only password setup/reset, exact password capitalization, case-insensitive username, protected session cookies, rejection of forged/revoked sessions, logout and brute-force throttling. It also exercises the complete submission/moderation/resolution workflow, private notes, public updates, filters, analytics, stale-write conflicts, archive/restore and reference-probing limits. Test records are labeled and archived; the local password fixture is never a hosted credential.

`node node_modules/typescript/bin/tsc --noEmit` checks the source. `npm run build` builds the production Worker. Browser QA covers the form, receipt, copy button, status checker, admin management and 320 / 375 / 390 / 430 / 768 / 1024 / 1440 / 1920 widths. A browser WebMCP tool exposes public status checking and uses the same interface state and server protection; unsupported browsers continue normally.

Test outcomes and screenshots are saved under ignored `outputs/`. The local preview's test identity and records are not production administrator accounts or production data.
