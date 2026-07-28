# True Goshen — Security Audit (2026-07)

**Auditor role:** Principal Security Engineer / Penetration Tester / OWASP specialist
**Scope:** `true-goshen-auto` (Next.js 16 App Router, Supabase, Vercel, custom admin auth, customer auth, PWA)
**Production:** https://truegoshen.vercel.app
**Method:** Static source review of auth, authorization, API routes, uploads, headers/cookies, DB/RLS, PWA, dependencies. No production data was mutated. No high-volume or destructive testing was performed.

> **Environment note:** During this engagement the sandbox shell was non-functional, so `npm audit`, `tsc`, `next build`, `vitest`, and `npx vercel` could **not** be executed, and no live-flow verification or deploy was performed. All dynamic-verification and deploy steps are listed as action items for the user. Findings below are from source analysis.

---

## 1. Executive summary

The application has a **materially stronger** security posture than typical projects of its size. Auth is custom but thoughtfully built: HMAC-signed team sessions with password-fingerprint invalidation, scrypt password hashing with per-hash salt and constant-time compare, rate limiting on all authentication and account-recovery endpoints, upload MIME **magic-byte** validation plus filename randomization and server-side `sharp` re-encoding, escaped PostgREST `.or()` filters, cron endpoints gated by `CRON_SECRET`, service-role key never exposed to `NEXT_PUBLIC`, customer JWTs validated server-side via `supabase.auth.getUser()`, and RLS enabled broadly with `SECURITY DEFINER` RPC execute revoked from `anon`/`authenticated`.

No trivially-exploitable unauthenticated RCE/SQLi/auth-bypass was found. The most important issue is an **authenticated privilege-escalation path**: a `super_admin` can assign the `owner` role (to themselves or others) and can modify/disable the real owner account, because the `platform-users` PATCH handler accepts `owner` as a target role without verifying the actor is an owner.

**Risk rating:**
- **Before:** Medium–High (one High privilege-escalation issue; several Medium hardening gaps: no HSTS, unthrottled public write endpoints, admin API responses cached by the service worker, raw DB error leakage).
- **After fixes applied in this pass (privilege-escalation guard + HSTS):** Medium. Remaining Medium items (public-endpoint rate limiting, SW admin caching, error sanitization, middleware RBAC path mismatch) are documented with fixes and deferred pending a working build/verify environment.

**Counts:** Critical 0 · High 1 · Medium 6 · Low 6 · Informational/Good-practice: many.

---

## 2. Architecture recap (as built)

- **Admin owner bootstrap:** env `ADMIN_PASSWORD` + `ADMIN_SECRET`. Cookie `tg_admin_session` value = `sha256(password:secret)` (deterministic), `httpOnly`, `secure` in prod, `sameSite=lax`, `maxAge` 12h. `src/lib/admin/config.ts`, `src/app/api/admin/login/route.ts`.
- **Team users:** `platform_users` table; login via `authenticatePlatformUser`; session cookie `tg_platform_session` = `base64url(payload).HMAC-SHA256`, payload `{uid, role, exp, pwd}` where `pwd` is a fingerprint of the stored `password_hash`. TTL 12h. `src/lib/platform/session.ts`, `src/lib/admin/auth.ts`.
- **Authorization:** roles `owner > super_admin > manager > staff`; permission sets in `src/lib/platform/permissions.ts`. API routes call `requireAdmin()` (any authenticated admin) or `requirePermission(<perm>)`.
- **Middleware:** `src/proxy.ts` (Next 16 renamed `middleware`→`proxy`). Redirects `/platform/*`→`/admin/platform/*`; rewrites `/admin/platform/*`→`/platform/*`. Platform pages also enforce auth server-side in `src/app/platform/layout.tsx`.
- **Customer auth:** Supabase; browser holds session (localStorage via `persistSession`); API calls send `Authorization: Bearer <jwt>` validated by `getCustomerFromAuthHeader` → `supabase.auth.getUser(token)`.
- **DB access:** server routes use the **service-role** client (`createAdminSupabase`, bypasses RLS) and rely on explicit ownership filters for customer data; browser uses the **anon** client (RLS-enforced).

---

## 3. Findings

### HIGH

#### H-1 — Privilege escalation: `super_admin` can grant the `owner` role and modify the owner account
**Location:** `src/app/api/admin/platform-users/route.ts` — `PATCH` (role validation ~L597; `updates` apply ~L659–L692).
**Detail:** `PATCH` is gated by `requirePermission("users")`, which is held by **owner and super_admin**. The role validation is:
```ts
if (role && !INVITABLE_ROLES.includes(role) && role !== "owner" && role !== "super_admin") {
  return 400 "Invalid role";
}
```
`INVITABLE_ROLES = [super_admin, manager, staff]`, so the accepted set is `{super_admin, manager, staff, owner}`. There is **no check that the actor is an owner** before assigning `owner`. A `super_admin` can therefore:
- `PATCH {id:<self>, role:"owner"}` → self-escalate to owner, and
- `PATCH {id:<real owner>, status:"disabled"}` or `{role:"manager"}` → disable/demote the legitimate owner.

Owner is a genuine higher tier: owner-only capabilities include viewing invite links (`canViewInviteLinks`), deleting customers (`canDeleteCustomer`), permanently deleting trash (`canPermanentlyDeleteTrash`), and setting an owner's password (already guarded here). The password branch guards owner targets (`normalizeRole(target.role) === "owner" && !canViewInviteLinks(auth.auth)` → 403) but the **role/status/name** branch does not — an inconsistency that confirms the gap.

**Exploit scenario:** A disgruntled or compromised `super_admin` promotes themselves to `owner`, then deletes customers / views invite links / locks out the owner.
**Fix (applied in this pass):** Reject assigning `role === "owner"` unless the actor is an owner (`canViewInviteLinks(auth.auth)`), and reject modifying an existing owner account (role/status/name) unless the actor is an owner. See §5.

---

### MEDIUM

#### M-1 — No HSTS header
**Location:** `next.config.ts` `headers()`.
**Detail:** Response headers set `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, but **not** `Strict-Transport-Security`. Without HSTS, first-visit downgrade/SSL-strip on hostile networks is possible.
**Fix (applied in this pass):** Add `Strict-Transport-Security: max-age=63072000; includeSubDomains` on `/:path*`. (Preload intentionally omitted to avoid an irreversible commitment.) Vercel serves HTTPS-only, so this is non-breaking.

#### M-2 — Public state-changing endpoints have no rate limiting
**Location:** `src/app/api/inquiries/*` (`preorder`, `appointment`, `price-alert`, `freight-advice`, `custom-preorder`), `src/app/api/parts/orders`, `src/app/api/customer/inquiries`, `src/app/api/push/subscribe`.
**Detail:** These accept unauthenticated POSTs that write DB rows and trigger outbound notifications (email/WhatsApp/SMS). `/api/inquiries/preorder` can additionally **create a customer account and generate a password-reset link**. None call `consumeRateLimit`. Auth and recovery endpoints (`admin/login`, `invite/accept`, `backup-codes/login`, passkey login, `forgot-password`, `customer/delete-account`, `tracking`, `validate-email`) *are* throttled.
**Exploit scenario:** Automated spam → DB bloat, notification-cost abuse, and reset-link/account-creation abuse.
**Fix (recommended, deferred):** Apply `consumeRateLimit("public-inquiry", requestIp(req.headers), {limit, windowMs})` per endpoint (e.g., 10/10min). Reuses existing limiter; low risk but touches several files — implement and test together.

#### M-3 — Service worker caches authenticated admin API responses
**Location:** `src/app/sw.ts` — `AUTH_API_PREFIXES` / `runtimeCaching`.
**Detail:** `AUTH_API_PREFIXES` only lists `/api/admin/login`, `/api/admin/logout`, `/api/customer/`, `/api/push/subscribe`. Every **other** `/api/admin/*` route (e.g. `/api/admin/stats`, `/api/admin/customers`, `/api/admin/sales`, `/api/admin/vehicles`) matches the *public* API rule and is stored in the `api-public-v4` Cache Storage bucket via `NetworkFirst`. Customer API responses are cached in `api-auth-v4` (also `NetworkFirst`, still persisted).
**Exploit scenario:** On a shared/kiosk browser, admin/customer data (customer lists, sales, finance figures) remains in Cache Storage after logout and can be read or served stale.
**Fix (recommended, deferred):** Treat all `/api/admin/` (and ideally `/api/customer/`) as `NetworkOnly` (do not persist). Bump `CACHE_VERSION`. SW changes need real device/offline testing before deploy.

#### M-4 — Middleware section-RBAC path prefix mismatch (needs runtime confirmation)
**Location:** `src/proxy.ts` `isProtectedAdminPath` / `isInvitePath` vs. canonical `/admin/platform/*` URLs; `permissionForPath` uses `/admin/platform`.
**Detail:** `isProtectedAdminPath` matches `/{admin}/dashboard` or `/platform`, and `isInvitePath` matches `/platform/invite/...`. Canonical browser URLs are `/admin/platform/*` (after the `/platform`→`/admin/platform` redirect, before the rewrite back to `/platform/*`). If middleware observes the pre-rewrite `/admin/platform/*` path, then `permissionForPath` (section-level RBAC) never runs at the edge, and section authorization relies entirely on the platform layout's blanket auth check plus each API's `requirePermission`. Because APIs *do* enforce `requirePermission`, this is a **defense-in-depth** gap, not a direct data-exposure bug (a staff user could render a page shell whose data APIs then return 403).
**Caveat:** Next 16 changed middleware/proxy semantics (per `AGENTS.md`), and the invite-acceptance flow depends on this path handling; a blind edit here could break redirects/invites. **Do not change without a live test.**
**Fix (recommended, deferred):** Confirm at runtime whether `permissionForPath` executes for `/admin/platform/*`. If not, align the prefixes to `/admin/platform` and re-test invite + all sections.

#### M-5 — Raw database/internal error messages returned to clients
**Location (examples):** `admin/site-content/upload` & `admin/vehicles/upload-image` (`error.message` on 500), `admin/platform-users` (`withSchemaMigrationHint` returns raw message for non-schema errors), `admin/customers/[id]` (`error.message`), `admin/change-password` (`updateError.message`).
**Detail:** Supabase/Postgres error strings can leak schema, column names, and constraint details.
**Fix (recommended, deferred):** Return a generic message on 500s and log detail server-side (Sentry is already wired). Low risk but spread across files — batch and test.

#### M-6 — In-memory rate limiter is per-instance
**Location:** `src/lib/security/rate-limit.ts`.
**Detail:** Counters live in a module-scope `Map`. On Vercel's multi-instance serverless runtime, an attacker's requests spread across instances dilute the effective limit, and counters reset on cold start.
**Fix (recommended, deferred / documented limitation):** Acceptable as a baseline; for hard guarantees move to a shared store (e.g., Upstash Redis). Document the limitation where limits are relied upon.

---

### LOW

- **L-1 — Static, non-revocable owner bootstrap token.** `tg_admin_session` value is deterministic (`sha256(password:secret)`), identical across logins, not individually revocable, valid until env rotation (cookie TTL 12h). `httpOnly`+`secure` mitigate exfil. Consider minting a signed, expiring, per-session owner token like the team-session format.
- **L-2 — Stateless team session has no server-side revocation.** Logout only clears the cookie; a captured `tg_platform_session` remains valid until `exp` (12h). Mitigated by password-change invalidation via the `pwd` fingerprint. Acceptable JWT tradeoff; document it.
- **L-3 — Supabase customer session in `localStorage`.** XSS-exfiltratable (standard Supabase behavior). Keep CSP/anti-XSS discipline; there are currently no unsafe HTML sinks (see Good practices).
- **L-4 — `dangerouslyAllowSVG: true` for `next/image`.** Mitigated by `contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"` and `contentDispositionType: attachment`. Acceptable; keep as is.
- **L-5 — Broad remote image `remotePatterns`.** Wildcards (`*.fbcdn.net`, `*.pinimg.com`, `*.googleusercontent.com`, etc.) widen the `next/image` optimizer's fetch surface (bandwidth abuse via crafted `?url=`), but the SVG sandbox and `attachment` disposition limit impact. Consider narrowing over time.
- **L-6 — Admin login lockout is throttle-only.** 5 attempts / 15 min per `ip:email`; no progressive/account-level lockout. Acceptable; optionally add escalating backoff.

---

### INFORMATIONAL — verified good practices

- **Uploads** (`admin/site-content/upload`, `admin/vehicles/upload-image`): permission-gated; size caps; MIME **magic-byte** verification (`src/lib/security/media-signature.ts`); server-side `sharp` re-encode (`enhance-upload.ts`, `failOn:"none"`); randomized `Date.now()-uuid` filenames; upload to a fixed bucket. SVG upload not accepted.
- **Password hashing:** `scrypt` + 16-byte random salt + `timingSafeEqual` (`src/lib/platform/password.ts`).
- **Invite flow:** tokens stored as SHA-256 hashes; single-use (`accepted_at`); 24h expiry enforced on validate + accept; accept is rate-limited.
- **PostgREST `.or()` injection:** values escaped/quoted (`src/lib/security/postgrest-filter.ts`).
- **Customer data scoping:** queries filtered by validated `user_id`/`email` (no IDOR observed in `customer/tracking`, `delete-account`, etc.).
- **Cron auth:** `CRON_SECRET` via `verifyCronSecret`; `correct-colors` allows cron OR `inventory_edit`.
- **Secrets:** service-role key only from `SUPABASE_SERVICE_ROLE_KEY` (never `NEXT_PUBLIC`); env validators reject dashboard/placeholder values.
- **XSS:** only one `dangerouslySetInnerHTML` (`src/app/layout.tsx`) and it renders a **constant** cache-recovery script, not user input. CMS/admin-entered content is rendered as React text.
- **SSRF:** "stock photo suggestions" build deterministic Pexels URLs; no server-side fetch of user-supplied URLs.
- **Auth errors:** generic "Invalid email or password"; `forgot-password` returns a generic response (no user enumeration).
- **RLS:** enabled across ~30 migrations; `073_security_hardening.sql` revokes `SECURITY DEFINER` RPC execute from `PUBLIC/anon/authenticated`, granting only `service_role`.
- **Headers:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`; `/admin/platform/*` set `Cache-Control: no-store`.

---

## 4. Prioritized fix plan

1. **[H-1]** Guard `owner` role assignment / owner-account modification in `platform-users` PATCH. *(Applied this pass.)*
2. **[M-1]** Add HSTS header. *(Applied this pass.)*
3. **[M-2]** Rate-limit public inquiry/order/push endpoints. *(Deferred — needs batch + test.)*
4. **[M-3]** Stop caching `/api/admin/*` (and `/api/customer/*`) in the service worker. *(Deferred — needs offline test.)*
5. **[M-5]** Sanitize 500 error bodies. *(Deferred.)*
6. **[M-4]** Confirm & fix middleware RBAC path mismatch. *(Deferred — needs live test; risky.)*
7. **[M-6]/[L-1]/[L-2]** Durable rate limiter; per-session owner token; session revocation. *(Deferred / roadmap.)*
8. Run `npm run audit:prod` and apply safe, non-breaking updates. *(Deferred — shell unavailable.)*

---

## 5. Fixes applied in this pass

*(Populated by the hardening phase; see repo diff. Deploy was NOT performed — see Environment note.)*

- **H-1 privilege-escalation guard** — `src/app/api/admin/platform-users/route.ts` PATCH: only an owner may assign the `owner` role or modify an existing owner account.
- **M-1 HSTS** — `next.config.ts`: `Strict-Transport-Security: max-age=63072000; includeSubDomains`.

## 6. Verification still required (blocked by unavailable shell)

Run from `true-goshen-auto/`:
```
npm run typecheck
npm run lint
npm run test
npm run build
npm run audit:prod
```
Then deploy and verify live flows (admin login, customer login, inventory browse, vehicle save, site-content save, uploads, notifications, no console/CSP breakage on home + admin dashboard):
```
npx vercel --prod --yes
```
