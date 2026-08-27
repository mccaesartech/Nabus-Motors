# Phase 1 — IAM Audit (read-only)

**Date:** 2026-07-29  
**Production:** https://truegoshen.vercel.app  
**Supabase project:** `ddrknhvkhmgdtavpuiiq`  
**Custom auth domain target:** `auth.truegoshen.com` (see `docs/SUPABASE_AUTH_DOMAIN.md`)  
**Scope:** Document existing identity/access flows. **No code changes in this phase.**

---

## 1. Executive snapshot

| Area | Current state | Gap vs IAM program |
|------|---------------|-------------------|
| Customer auth | Supabase Auth (email/password + Google OAuth) | Login rate-limit/lockout, suspicious login, MFA (customer) |
| Platform auth | Custom HMAC cookie + optional owner `ADMIN_PASSWORD`; WebAuthn passkeys + backup codes | Role model narrower than requested 7 IAM roles |
| Sessions (customer) | Browser storage preference + 24h client expiry | No device/IP/country inventory or revoke-all |
| Sessions (platform) | Signed cookie 12h; password-hash fingerprint invalidates | No multi-device list |
| Middleware | `src/proxy.ts` (Next proxy, not classic `middleware.ts`) | Customer routes not edge-gated |
| Emails | Resend + Supabase Auth SMTP mix | Partial branding; verify/welcome/MFA templates incomplete |
| Observability | Sentry wired (client/server/edge) + `platform_error_log` | Replay/admin toggles incomplete |
| Security headers | HSTS, XFO, nosniff, Referrer, Permissions-Policy | No CSP; no explicit CSRF tokens |
| Auth domain | Docs ready; prod still on `*.supabase.co` | Needs Supabase Pro + DNS + Vercel env |

---

## 2. Auth surfaces (map)

### 2.1 Customer (public site)

| Route / API | Purpose |
|-------------|---------|
| `/login` | Email/password + Google; Remember Me; show-password via `PasswordInput` |
| `/register` | Full name + email + phone + password/confirm; Google; email domain validate |
| `/auth/callback` | OAuth code → `exchangeCodeForSession`; redirect sanitize |
| `/forgot-password` + `/api/customer/forgot-password` | Recovery (rate-limited); Resend/Supabase |
| `/reset-password` | `updateUser({ password })` after recovery session |
| `/account`, `/account/settings` | Authenticated customer UI (client session) |
| `/api/customer/*` | Bearer token via `getCustomerFromAuthHeader` / `getCustomerFromBearerToken` |

**Client stack:**

- `src/lib/supabase/client.ts` — `createClient` + preference-aware storage
- `src/lib/supabase/auth-storage.ts` — localStorage / sessionStorage / memory
- `src/lib/customer/session-preference.ts` — stay_signed_in / ask_each_time / no_save; 24h absolute max
- `src/context/customer-auth-context.tsx` — session, profile sync, preference modal
- `src/components/customer/customer-session-guard.tsx` — client-side expiry → `/login?expired=1`
- `src/lib/customer/google-oauth.ts` — `signInWithOAuth({ provider: "google" })`
- `src/lib/customer/login-errors.ts` — maps some Supabase messages; **fallback still returns raw `message`**

### 2.2 Platform / admin

| Route / API | Purpose |
|-------------|---------|
| `/admin` | Platform login UI |
| `/api/admin/login` | Email/password (platform_users) or owner password; rate limit 5/15m; HttpOnly cookies |
| `/platform/*` (rewritten `/admin/platform/*`) | RBAC via `proxy.ts` + `permissionForPath` |
| Passkeys | `/api/admin/passkeys/*` + WebAuthn tables (migration 072) |
| Backup codes | `/api/admin/backup-codes/*` |
| Invite accept | `/api/admin/invite/accept` (rate-limited) |

**Session cookies:**

| Cookie | Contents | Flags (login route) |
|--------|----------|---------------------|
| `PLATFORM_USER_COOKIE` (`tg_platform_session`) | HMAC-signed `{uid,role,exp,pwd}` | httpOnly, sameSite=lax, secure in prod, maxAge 12h |
| `ADMIN_COOKIE` | Owner token from `ADMIN_PASSWORD` | httpOnly, sameSite=lax, secure in prod |

Password change invalidates platform sessions via `pwd` fingerprint (`src/lib/platform/session.ts`).

Edge auth: `src/lib/admin/platform-auth-request.ts` (crypto.subtle only — no DB on edge). Full verification with DB: `verifyPlatformSessionCookie` in `src/lib/admin/auth.ts`.

### 2.3 Proxy / maintenance

`src/proxy.ts`:

1. Auto-division domain redirect  
2. Maintenance mode (platform admins bypass)  
3. Protect `/…/dashboard` and `/platform` — redirect unauthenticated to admin login  
4. Permission check → redirect to dashboard if unauthorized  

**Customer `/account` is not edge-protected** — relies on client auth context.

---

## 3. Tokens, refresh, storage

| Concern | Implementation |
|---------|----------------|
| Customer access/refresh | Supabase JWTs; `autoRefreshToken: true` |
| Storage key | `sb-{ref}-auth-token` derived from `NEXT_PUBLIC_SUPABASE_URL` host |
| Remember Me | Preference → localStorage vs sessionStorage vs memory |
| Server customer APIs | Bearer from client `getSession()` — **not** cookie SSR session |
| Platform | Opaque signed cookie (not Supabase JWT) |
| Refresh on password change (customer) | Not systematically forcing logout of other devices |

**Risk:** Customer tokens live in browser storage (XSS-sensitive). Platform uses HttpOnly cookies (better).

---

## 4. OAuth / Google

- Provider: Supabase Google OAuth  
- App callback: `/auth/callback?redirect=…` on **site origin**  
- Google → Supabase host: currently `ddrknhvkhmgdtavpuiiq.supabase.co` until custom domain  
- Env accepts custom host: `src/lib/supabase/env.ts`  
- Profile names: migration `059_google_oauth_profile_names.sql`  
- Failures: some paths surface Supabase/`error_description` text  
- Duplicate email merge: not fully enterprise (identity linking / conflict UX incomplete)

**Blocked externally:** Custom Domain needs Supabase Pro + DNS CNAME + Google redirect URI + Vercel `NEXT_PUBLIC_SUPABASE_URL=https://auth.truegoshen.com` + redeploy.

---

## 5. Registration & password policy (today)

| Rule | Current |
|------|---------|
| Fields | Full name (single), email, phone, password, confirm |
| Min length | **8** (not 12) |
| Complexity | No upper/lower/number/special enforcement |
| Strength meter | None |
| Live validation | Partial (email domain API) |
| Duplicate email | Falls through to sign-in attempt / Supabase error |
| First/Last split | Only via trigger from `full_name` metadata |

---

## 6. Email verification

- Driven by Supabase Auth confirm settings (dashboard)  
- App message when unconfirmed; redirect to login when no session after signup  
- Emails often Supabase-branded unless custom SMTP/templates configured  
- No dedicated branded verify landing with auto-login orchestration beyond default Auth

---

## 7. MFA

| Actor | MFA |
|-------|-----|
| Platform | WebAuthn passkeys + hashed backup codes (072) — **not TOTP** |
| Customer | **None** |
| Admin enforce MFA | UI/settings partial; no org-wide TOTP enforce for customers |

---

## 8. RBAC (platform)

Canonical roles in code (`src/lib/platform/permissions.ts`):

`owner` | `super_admin` | `manager` | `staff`

Legacy map includes `"Sales Officer"` → `staff`, `"Finance Officer"` → `staff`, `"Viewer"` → `staff`.

**Requested IAM roles** (Customer, Sales Officer, Inventory Officer, Freight Officer, Accounts, Administrator, Super Administrator) are **not** first-class `PLATFORM_ROLES`. Mapping must extend carefully without breaking Owner/Manager/Staff.

Customer role is Supabase `auth.users` + `profiles`, separate from `platform_users`.

---

## 9. Rate limiting & lockout

| Endpoint | Rate limit |
|----------|------------|
| Admin login | 5 / 15 min (in-memory Map) |
| Forgot password | Yes |
| Validate email | Yes |
| Invite accept | Yes |
| Customer password login | **Client-only** — relies on Supabase throttling |

**Gaps:** No persistent lockout table; no suspicious-login (geo/device) alerts; in-memory limits reset per serverless instance.

---

## 10. Security hardening present vs missing

**Present:**

- Security response headers (no CSP) in `next.config.ts`  
- Open-redirect sanitize on auth redirects  
- Admin cookie SameSite=lax + HttpOnly  
- PostgREST filter helpers / safe logging / media signatures under `src/lib/security/`  
- Migration 073: revoke PUBLIC execute on sensitive RPCs  
- Error logger sanitizes and sends to Sentry when DSN set  

**Missing / weak:**

- Content-Security-Policy  
- Explicit CSRF for cookie-auth state-changing admin APIs (SameSite helps; not full CSRF tokens)  
- Customer login server-side rate limit + account lockout  
- Friendly error fallback still leaks raw Supabase strings (`customerLoginErrorMessage`)  
- No CSP / sanitisation layer for rich HTML  
- Customer session not HttpOnly  

---

## 11. Error pages & Sentry

| Asset | Status |
|-------|--------|
| `/not-found` | Branded `StatusPage` 404 |
| `global-error.tsx` | Brand colors + Sentry capture |
| `error.tsx` (app/account/auto/platform) | Present |
| `/maintenance` | Present + proxy gate |
| Dedicated 401/403 pages | **Missing** (platform redirects to login/dashboard) |
| Sentry | Client/server/edge init; tracing sample rates; **no Session Replay**; limited admin config |

---

## 12. Email templates (branded)

Existing send paths: password reset, platform invite, customer message, shipment tracking (Resend).

**Gaps for Phase 14:** welcome, verify, login alert, new device, password changed, MFA on/off — need templates + triggers.

---

## 13. Database / migrations

Relevant migrations already applied in repo history:

- `010_customer_auth.sql` — profiles trigger  
- `056_session_preference.sql`  
- `059_google_oauth_profile_names.sql`  
- `072_admin_passkeys.sql` — WebAuthn + backup codes  
- `073_security_hardening.sql`  
- `082_vehicle_stock_quantity.sql` (latest known vehicle stock)  
- Higher numbers may exist (`083`–`086` referenced in code comments)

**Likely new migrations for later phases:** auth attempt / lockout, login history, customer sessions/devices, TOTP secrets, expanded roles — only when required.

---

## 14. Supabase configuration (documented expectations)

| Setting | Expected |
|---------|----------|
| Site URL | `https://truegoshen.vercel.app` |
| Redirect URLs | App `/auth/callback` on prod + custom domains + localhost |
| Google redirect | `*.supabase.co/auth/v1/callback` (+ `auth.truegoshen.com` when live) |
| `NEXT_PUBLIC_SUPABASE_URL` | Still default host in production HTML (per auth domain doc) |

---

## 15. Security weakness register (prioritized)

| ID | Severity | Finding |
|----|----------|---------|
| W1 | High | Customer JWTs in JS-accessible storage (XSS → account takeover) |
| W2 | High | No customer login rate-limit/lockout in-app |
| W3 | Medium | Raw Supabase errors can reach UI |
| W4 | Medium | Weak password policy (8 chars, no complexity) |
| W5 | Medium | No customer MFA / no device session inventory |
| W6 | Medium | Custom auth domain not live — Google shows Supabase host |
| W7 | Medium | In-memory rate limits ineffective across instances |
| W8 | Low | No CSP |
| W9 | Low | Platform roles don’t match requested IAM job titles |
| W10 | Low | Customer `/account` not edge-authenticated |
| W11 | Info | Owner shared `ADMIN_PASSWORD` path still exists |
| W12 | Info | Email branding / verification UX incomplete |

---

## 16. Extension points (do not rewrite)

Prefer extending:

- `src/lib/supabase/*`, `src/lib/customer/*`  
- `src/app/login`, `register`, `auth/callback`, `reset-password`  
- `src/lib/platform/permissions.ts` + `platform_users.role`  
- Existing Google OAuth + passkeys/backup codes  
- `src/lib/security/rate-limit.ts`, `src/lib/errors/logger.ts`  
- `src/proxy.ts` for edge gates  

---

## 17. Phase readiness

| Phase | Ready to implement in-repo? | External blocker |
|-------|----------------------------|------------------|
| 2 Login upgrades | Yes | Optional Upstash for distributed RL |
| 3 Registration | Yes | — |
| 4 Email verification | Partial | Supabase SMTP / dashboard templates |
| 5 Password reset | Yes (polish) | — |
| 6 Google OAuth | Code ready | Pro + DNS + Google Console + Vercel env |
| 7 MFA TOTP | Yes (new tables) | Authenticator apps only |
| 8–9 Sessions / history | Yes (migrations) | GeoIP may need free API or stub |
| 10 RBAC | Yes (map + permissions) | Careful data migration |
| 11 Hardening | Yes | — |
| 12 Error pages | Yes | — |
| 13 Sentry deepen | Partial | Sentry plan for Replay |
| 14 Branded emails | Yes if Resend key | Domain verify |
| 15 Final audit | After above | — |

---

## 18. Verdict

Baseline is a **production dual-auth system** (Supabase customers + custom platform sessions) with solid platform cookie design, passkeys, basic headers, and Sentry hooks. The IAM program should **incrementally harden customer login/register**, add **session/history/MFA**, **expand RBAC without breaking Owner/Manager/Staff**, and **document external auth-domain steps** — not replace Auth.

**Phase 1 complete.** Proceed to Phase 2.
