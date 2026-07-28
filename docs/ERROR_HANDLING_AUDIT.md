# Error Handling Audit — True Goshen

**Date:** 2026-07-28
**Scope:** every path where an error can reach a human (public site, customer account, admin platform at `/admin/platform/*`, API routes, cron, service worker).
**Goal:** no raw Supabase / Postgres / stack / internal text in the UI. Every failure gets a friendly message plus a support-traceable error ID.

Constraint for this work: **no business-logic change**. Response shapes stay backward compatible (`ok: false` is preserved everywhere; `success: false` and `errorId` are *added*).

---

## 1. Summary

| Severity | Count | Definition |
|---|---:|---|
| Critical | 18 | Raw Postgres/Supabase/storage text reaches a user on a high-traffic write path (vehicle save, site content, uploads, users). |
| High | 47 | Raw `error.message` returned as the user-visible `message` on an admin or customer API failure. |
| Medium | 23 | Client components render a thrown/echoed server string verbatim; helper defaults that pass raw text through. |
| Low | 9 | Missing/off-brand error surfaces (404, 401, 403, 503, maintenance), unstructured server logging, no error ID anywhere. |
| **Total** | **97** | |

### Top leak locations

1. `src/app/api/admin/vehicles/route.ts` — 5 sites. `friendlyAdminDbError(error.message)` **returns the raw message unchanged when no rule matches** (`src/lib/admin/api-errors.ts:75`). This is the single highest-traffic admin write path.
2. `src/app/api/admin/freight/shipments/route.ts` — 7 sites, all `message: error.message`.
3. `src/app/api/admin/platform-users/route.ts` — 7 sites (invite, password set, role update, delete fallback).
4. `src/app/api/admin/parts/route.ts` + `parts/categories/route.ts` — 8 sites.
5. `src/app/api/admin/vehicles/upload-image/route.ts` and `src/app/api/admin/site-content/upload/route.ts` — raw Supabase Storage errors, including a branch that *deliberately* concatenates the storage error into the user message.
6. `src/app/api/admin/settings/route.ts:73` — returns `db.error` (raw connection/permission text) in a success payload rendered on the Settings page.
7. `src/lib/admin/client.ts:37` — `parseAdminResponse` puts up to 240 characters of a **non-JSON** response body straight into `message` (can be a proxy/HTML error page).
8. No `not-found.tsx` anywhere in `src/app` → the stock Next.js 404 renders outside the brand shell.

---

## 2. Existing helpers (extend, do not duplicate)

| File | What it does | Verdict |
|---|---|---|
| `src/lib/admin/api-errors.ts` | `friendlyAdminDbError(message)` — 10 hand-written string rules for known schema/constraint failures. **Falls through to the raw message.** | Keep + wrap. It already encodes real operational knowledge (missing gallery columns, `vehicles_local_shipment_exclusive`, VIN uniqueness). New DB mapper calls it first, then guarantees a safe default. |
| `src/lib/errors/public-error.ts` | `PUBLIC_UNEXPECTED_ERROR_MESSAGE`, `publicErrorReference(digest)` used by `error.tsx` / `global-error.tsx`. | Keep as-is. New code lives beside it in `src/lib/errors/`. |
| `src/lib/security/safe-logging.ts` | `summarizeRecordForLog` — field-name-only payload summary. | Reuse verbatim inside the new logger for request bodies. |
| `src/lib/observability/request-error.ts` | `buildRequestErrorRecord` for `onRequestError`. | Keep. Complementary (framework-level), new logger is handler-level. |
| `src/lib/observability/schema-issue.ts` | `reportSchemaIssue`, `isMissingColumnError`. | Keep, unchanged. |
| `src/lib/admin/client.ts` | `parseAdminResponse`, `adminErrorMessage`, `fetchWithTimeout`, `isAdminAuthError`. | Extend: teach it about `errorId`, and stop echoing raw non-JSON bodies. |
| `src/components/shared/client-error-boundary.tsx` | Component-level class boundary with retry. | Keep, already friendly. |

---

## 3. Next.js error-file conventions present / missing

Next.js **16.2.9**. `error.tsx` supports `reset()` and (new in 16.2) `unstable_retry()`. `not-found.tsx` is the 404 convention; `unauthorized.tsx`/`forbidden.tsx` require the experimental `authInterrupts` flag, which is **not** enabled in `next.config.ts` — so 401/403 are delivered as ordinary routes instead.

| File | Status |
|---|---|
| `src/app/error.tsx` | Present, friendly, has cache-recovery + digest reference. |
| `src/app/global-error.tsx` | Present, inline-styled, Sentry capture. |
| `src/app/not-found.tsx` | **Missing** (Critical-adjacent, Low severity) |
| `src/app/platform/error.tsx` | **Missing** — a thrown server component in the admin shell falls all the way to the public-themed root `error.tsx`. |
| `src/app/platform/not-found.tsx` | **Missing** |
| `src/app/account/error.tsx`, `src/app/auto/error.tsx` | **Missing** |
| `src/app/offline/page.tsx` | Present and on-brand. Improve only (add "what still works" guidance). |
| Maintenance / 503 page | **Missing** |
| 401 / 403 pages | **Missing** (proxy silently redirects a forbidden admin route to the dashboard — no explanation, `src/proxy.ts:42-48`) |
| `loading.tsx` | Present at root, `/platform`, `/account`, `/auto/inventory`, `/auto/cart`, `/auto/inventory/[slug]`. Adequate. |

---

## 4. Leak inventory

### 4.1 Critical — raw DB/storage text on high-traffic write paths

| # | Location | What the user sees today | Proposed replacement |
|---|---|---|---|
| C1 | `api/admin/vehicles/route.ts:304` (GET list) | `column vehicles.xyz does not exist` | "We could not load the vehicle list. Try again — if it keeps failing, quote **TG-XXXXXX**." |
| C2 | `api/admin/vehicles/route.ts:387` (POST create) | `duplicate key value violates unique constraint "vehicles_vin_key"` (only if the VIN rule matches; otherwise raw) | Mapped by constraint name → "Another vehicle already uses this VIN…" ; unmapped → generic + error ID. |
| C3 | `api/admin/vehicles/route.ts:508` (PATCH existing lookup) | Raw PostgREST text | "We could not load that vehicle to update it." |
| C4 | `api/admin/vehicles/route.ts:592` (PATCH update) | **`new row for relation "vehicles" violates check constraint "vehicles_local_shipment_exclusive"`** | Existing rule already covers this string, but only via substring match on the *raw* message. Replace with a **code-first** map (`23514` + constraint name) → "Locally available stock cannot also be marked for shipment. Turn off 'Shipment available' or 'Available locally', then save again." |
| C5 | `api/admin/vehicles/route.ts:703` (PATCH approval/publish write) | Raw | Mapped / generic + ID. |
| C6 | `api/admin/vehicles/route.ts:865` (DELETE lookup) | Raw | "We could not check those vehicles before deleting them." |
| C7 | `api/admin/vehicles/approval/route.ts:210` | Raw | "The approval could not be saved." |
| C8 | `api/admin/site-content/route.ts:194` (CMS save) | Raw upsert error, e.g. `relation "site_content" does not exist` | Keep the actionable migration hints from `friendlyAdminDbError`; everything else → "Your website content could not be saved." |
| C9 | `api/admin/site-content/upload/route.ts:176-179` | `${error.message} Run migration 016_…` — deliberately concatenates raw storage text | Keep the migration hint sentence, drop the raw prefix. |
| C10 | `api/admin/vehicles/upload-image/route.ts:115-119` | `Upload rejected by storage: ${error.message}. Allowed types: …` | "That image was rejected by storage. Use a JPEG, PNG, or WebP under 5 MB." |
| C11–C13 | `api/admin/platform-users/route.ts:523, 646, 676` | `withSchemaMigrationHint(rawMessage)` — raw text plus a migration hint | Preserve hint, replace raw body. |
| C14–C15 | `api/admin/platform-users/route.ts:809, 813` (DELETE) | Raw | "We could not remove that team member." |
| C16 | `api/admin/platform-users/route.ts:873` (disable fallback) | Raw | "We could not disable that account." |
| C17 | `api/admin/settings/route.ts:73` | Raw DB connectivity/permission text rendered in the Settings "database" card | "Database check failed." + error ID; details go to the log only. |
| C18 | `lib/admin/client.ts:37` | Up to 240 raw characters of a non-JSON body (HTML error page, proxy text) | Fixed message keyed to the status code. |

### 4.2 High — `message: error.message` on API failure

All of these return HTTP 500 with the raw Supabase message as the user-facing string. Proposed replacement for every row: **domain-specific friendly sentence + `errorId`**, raw detail logged server-side only.

| Area | File | Lines |
|---|---|---|
| Admin notifications | `api/admin/notifications/route.ts` | 102, 129, 150 |
| Customer notifications | `api/customer/notifications/route.ts` | 65, 82, 101 |
| Freight shipments | `api/admin/freight/shipments/route.ts` | 94, 115, 212, 326, 393, 433, 474 |
| Freight quotes | `api/admin/freight/quotes/route.ts` | 31, 170, 194 |
| Spare parts | `api/admin/parts/route.ts` | 40, 85, 164, 206 |
| Parts categories | `api/admin/parts/categories/route.ts` | 30, 68, 104, 128 |
| Sales | `api/admin/sales/route.ts` | 336, 376, 453 |
| Team messages | `api/admin/team-messages/route.ts` | 71, 156, 191, 209, 343 |
| Team groups | `api/admin/team-messages/groups/route.ts` | 125, 191 |
| Appointments | `api/admin/appointments/route.ts` | 28, 72, 129 |
| Documents | `api/admin/documents/route.ts` | 66, 90 |
| Inventory movements | `api/admin/inventory-movements/route.ts` | 89, 105 |
| Expenses | `api/admin/expenses/route.ts` | 97 |
| Orders | `api/admin/orders/[id]/route.ts` | 73 |
| Inquiries | `api/admin/inquiries/update/route.ts` 84 · `api/admin/inquiries/[type]/[id]/route.ts` 34 | — |
| Customer messages (admin) | `api/admin/customer-messages/route.ts` | 437 |
| Customers | `api/admin/customers/route.ts` 25 · `customers/[id]/route.ts` 37, 111 · `password-reset-link` 70 · `send-password-reset` 110 | — |
| Activity log | `api/admin/activity/route.ts` | 32 |
| Backup codes | `api/admin/backup-codes/generate/route.ts` | 56 |
| Reports export | `api/admin/reports/export/route.ts` | 168 |
| Image edit (AI) | `api/admin/vehicles/edit-image/route.ts` | 171 |
| Settings save | `api/admin/settings/route.ts` | 138 |
| Push subscribe (customer) | `api/push/subscribe/route.ts` | 96, 133 |

### 4.3 Medium — client components rendering server/raw strings

| Location | What the user sees | Proposed replacement |
|---|---|---|
| `components/admin/vehicle-form.tsx:130` | `err.message` from a thrown API message | `describeApiFailure()` → friendly sentence + "Reference TG-XXXXXX" |
| `components/platform/platform-vehicle-form.tsx:362, 1091` | same | same |
| `components/platform/site-image-upload.tsx:97, 102` | `throw new Error(json.message)` then renders it | same |
| `components/platform/site-video-upload.tsx:65, 71` | same | same |
| `components/platform/vehicle-ai-chat.tsx:423, 467, 635, 650, 786` | Gemini / stock-photo provider text | Friendly per-operation message; provider text logged only |
| `app/platform/team-chat/page.tsx:132, 167` | `err.message` (Supabase realtime/PostgREST) | "Team chat could not load. Check your connection and try again." |
| `components/platform/customer-invoice-print.tsx:72, 88, 107, 175, 188, 206, 261, 274, 293` | Mostly already friendly; the `error.message` branch can surface a DOM/print exception | Fixed strings (already largely present) |
| `app/platform/customers/page.tsx:100` · `customers/[id]/page.tsx:180` | echoes `json.message` | Fixed by the API-side fix; helper adds the ID |
| `lib/admin/logout-client.ts:26` | echoes `data.message` | Fixed by API-side fix |

### 4.4 Medium — helpers that pass raw text through

| Location | Issue |
|---|---|
| `lib/admin/api-errors.ts:75` | `return message;` — the default branch is the root cause of most Critical leaks. |
| `lib/admin/client.ts:37` | Raw non-JSON body echoed (also listed as C18). |
| `lib/admin/client.ts:42-50` | `adminErrorMessage` concatenates `message` + `warning` with no length or content guard. |

### 4.5 Auth flows

Reviewed and **already clean** — no change needed beyond adding error IDs:

- `api/admin/login/route.ts` — fixed strings, generic "Invalid email or password.", rate-limit message, no user enumeration.
- `lib/admin/auth.ts` — `requireAdmin` / `requirePermission` return "Session expired. Please sign in again." / "You do not have permission to perform this action."
- `api/customer/forgot-password/route.ts` — neutral responses.
- `api/admin/invite/*` — fixed strings.

**Exception (Medium):** the four passkey routes echo `@simplewebauthn` exception text:
`api/admin/passkeys/login/options/route.ts:31`, `login/verify/route.ts:37`, `register/options/route.ts:31`, `register/verify/route.ts:40`.
Library text such as `Unexpected authentication response challenge` is meaningless to users → replace with "Passkey sign-in failed. Try again or use your password."

### 4.6 Server components / Server Actions

- **No Server Actions exist** in this codebase (`"use server"` appears nowhere under `src/`). All mutations go through route handlers. A wrapper is still added for future use, but nothing is migrated.
- Server components (`lib/platform/*-server.ts`, `lib/site-content.ts`, `lib/supabase/vehicles.ts`) `console.error` and fall back to defaults rather than throwing — good behaviour, no leak. Throws that escape are caught by `error.tsx`, which already shows a generic message plus digest.

### 4.7 Cron / background / external services

- `api/cron/account-deletion-cleanup`, `correct-vehicle-colors`, `whatsapp-retry` — only return "Unauthorized"; internal detail stays in logs. **No leak.**
- Email (`lib/email/*`), WhatsApp (`lib/notifications/whatsapp-send.ts`), Termii SMS, Gemini (`lib/ai/*`) — all swallow provider errors with `console.error` and degrade. **No leak**, but logging is unstructured (Low).

### 4.8 Middleware / proxy

`src/proxy.ts:42-48` — a permission failure silently redirects to `/platform/dashboard` with no explanation. Not a leak, but a UX gap (Low): the user is bounced with no reason given.

### 4.9 Logging gaps (Low)

- ~130 `console.error` / `console.warn` call sites across 66 files, mostly `console.error("x failed:", error.message)`. No correlation ID, no route, no actor, no severity, not JSON — so a user reporting "it said something went wrong" cannot be matched to a log line.
- No persisted error store; nothing survives Vercel's log retention window.

---

## 5. Planned architecture (Phase 2)

| File | Purpose |
|---|---|
| `src/lib/errors/kinds.ts` | `AppErrorKind` union + `AppError` class and typed constructors; kind → HTTP status and default friendly message. |
| `src/lib/errors/error-id.ts` | `newErrorId()` → `TG-XXXXXX` (Crockford base32, no ambiguous characters). |
| `src/lib/errors/db-errors.ts` | Postgres/PostgREST code map (`23505`, `23503`, `23514`, `23502`, `22P02`, `42501`, `42P01`, `42703`, `PGRST116`, `PGRST301`, `57014`, `08006`, `ECONNRESET`) + constraint-name map. Calls `friendlyAdminDbError` first so existing operational hints survive. |
| `src/lib/errors/sanitize.ts` | Redacts request bodies/headers/query for logs (`password`, `token`, `secret`, `key`, `authorization`, `otp`, `code`, `cookie`; emails → `a***@domain`). Builds on `summarizeRecordForLog`. |
| `src/lib/errors/logger.ts` | `server-only`. Structured JSON log with error ID, timestamp, actor, IP, UA (browser/OS), route, method, module, status, kind, db code, stack, environment, release. Best-effort insert into `platform_error_log`; console-only if the table is absent. |
| `src/lib/errors/api.ts` | `apiFailure()` / `withApiErrorHandling()` → `{ ok: false, success: false, message, errorId }` with the right status. |
| `src/lib/errors/server-action.ts` | Wrapper for future Server Actions. |
| `src/lib/errors/client.ts` | Client-safe `describeApiFailure()`, `friendlyClientError()`, `formatErrorReference()`. |
| `src/components/shared/status-page.tsx` | Shared on-brand status layout (public theme). |
| `src/components/platform/platform-error-state.tsx` | Admin-theme error/empty state using `--platform-*` tokens. |
| `src/app/not-found.tsx`, `src/app/platform/not-found.tsx`, `src/app/platform/error.tsx`, `src/app/account/error.tsx`, `src/app/auto/error.tsx`, `src/app/unauthorized/page.tsx`, `src/app/forbidden/page.tsx`, `src/app/maintenance/page.tsx` | Error surfaces. |
| `src/app/platform/error-log/page.tsx` + `src/app/api/admin/error-log/route.ts` | Admin Error Log (owner / super_admin). |
| `supabase/migrations/084_platform_error_log.sql` | Table + indexes. **Run manually in the Supabase SQL Editor.** |

### Response shape

```jsonc
{ "ok": false, "success": false, "message": "…friendly…", "errorId": "TG-7K3QP2" }
```

`ok` is retained because ~40 client call sites branch on it. `success` is added to satisfy the enterprise standard. No client change is required for the shape itself.
