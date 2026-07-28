# Email validation (signup / invites)

True Goshen rejects obviously fake or undeliverable emails at customer registration
and platform invite entry points using a **practical** multi-layer check.

## What we check

1. **Format** — strong client/server format validation (local-part + domain + TLD).
2. **Disposable domains** — curated blocklist of temporary/throwaway providers
   (`mailinator`, `yopmail`, `guerrillamail`, etc.). Subdomains of blocked hosts
   are also rejected.
3. **MX / DNS** (server-only) — `dns.resolveMx` on the email domain. Domains with
   **no MX records** are rejected with:
   > This email domain looks invalid.

## What we do **not** claim

We **do not** SMTP-probe `RCPT TO` to prove a mailbox exists. That approach is:

- Unreliable (greylisting, catch-all domains, deferred responses)
- Often blocked (outbound port 25, anti-abuse policies)
- Easy to false-negative legitimate users

A domain that passes MX can still have invented local-parts
(`nobody-here-12345@gmail.com`). Full mailbox verification requires the user to
confirm via email (Supabase Auth confirmation) when enabled.

## Entry points

| Flow | Where |
|------|--------|
| Customer register (`/register`) | Local check + `POST /api/customer/validate-email` before `signUp` |
| Inline customer session (`ensureCustomerSession`) | Same server helper |
| Pre-order / freight account creation | `validateEmailForSignup` before `createUser` |
| Platform team invite (`POST /api/admin/platform-users`) | `validateEmailForSignup` before insert/invite |

## User-facing messages

| Code | Message |
|------|---------|
| `invalid_format` | Enter a valid email address. |
| `disposable` | Disposable email addresses aren't allowed. |
| `no_mx` | This email domain looks invalid. |

## Code

- `src/lib/email/validate-email.ts` — format + disposable (browser-safe)
- `src/lib/email/validate-email-server.ts` — MX lookup (`server-only`)
- `src/lib/email/disposable-domains.ts` — blocklist
- `src/app/api/customer/validate-email/route.ts` — public API for register UI
