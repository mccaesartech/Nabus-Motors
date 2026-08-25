# Custom domain DNS (truegoshengh.com) — launch cutover

**Canonical public URL:** `https://www.truegoshengh.com`

**Apex:** `https://truegoshengh.com` should redirect to www in Vercel once DNS works.

**Do not** set Production `NEXT_PUBLIC_SITE_URL` (or ship invite emails) on the custom domain until Steps A–B pass.

Until DNS is healthy, keep serving users on `https://truegoshen.vercel.app` only via the explicit emergency env (see Step E). Code defaults target www.

If you deploy this repo **before** DNS is fixed, set Production:

`PUBLIC_SITE_URL_EMERGENCY_FALLBACK=https://truegoshen.vercel.app`

Remove that variable as soon as Steps A–B pass (launch).

---

## A — Namecheap DNS (you must do this now)

### A1. Disable broken DNSSEC (do this first)

1. Log in at https://ap.www.namecheap.com/
2. **Domain List** → **Manage** next to `truegoshengh.com`.
3. Open the **Advanced DNS** tab.
4. Scroll to **DNSSEC**.
5. Turn DNSSEC **Off** (toggle), or remove the published DS record so the parent no longer has DS for this domain.
6. Wait until public DS is gone (often minutes; can take up to ~24–48h for cache). Verify with `nslookup truegoshengh.com 1.1.1.1` and `nslookup www.truegoshengh.com 1.1.1.1`.

Or open https://dns.google/resolve?name=truegoshengh.com&type=DS — `Answer` should be **empty**. Then A/NS queries should stop returning Status `2` (SERVFAIL).

Debugger: https://dnssec-debugger.verisignlabs.com/truegoshengh.com — must no longer report "DS is published, but a corresponding DNSKEY is not".

### A2. Point web records at Vercel

Still under **Advanced DNS**, set Host Records:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| **A Record** | `@` | `76.76.21.21` | Automatic (or 30 min) |
| **CNAME Record** | `www` | `cname.vercel-dns.com.` | Automatic |

- **Delete / replace** any existing `@` A record pointing at `216.198.79.1` (or any non-Vercel IP).
- Keep other records you need (Resend SPF/TXT/CNAME, `auth.` → Supabase, etc.). Do not delete those while fixing web DNS.
- Optional: if Vercel Domains UI later shows a project-specific CNAME, use that for `www`; `cname.vercel-dns.com` is already valid.

**Do not** switch nameservers to Vercel unless you intentionally migrate all DNS (email SPF/DKIM, `auth.` CNAME, etc.) into Vercel DNS.

---

## B — Verification commands (must pass before env flip)

```powershell
nslookup truegoshengh.com 1.1.1.1
nslookup www.truegoshengh.com 1.1.1.1
nslookup truegoshengh.com 8.8.8.8
nslookup www.truegoshengh.com 8.8.8.8
```

Expect:

- Apex → `76.76.21.21` (no SERVFAIL)
- www → CNAME `cname.vercel-dns.com` (then Vercel IPs)
- Browser: `https://www.truegoshengh.com` and `https://truegoshengh.com` load the site (TLS issued)
- https://dns.google/resolve?name=truegoshengh.com&type=A — `Status` `0`, not `2`
- https://dns.google/resolve?name=truegoshengh.com&type=DS — empty `Answer`

Vercel (no re-add expected if domains already attached):

```powershell
npx vercel domains ls --scope mccaesartech
npx vercel domains inspect truegoshengh.com --scope mccaesartech
```

Confirm `truegoshengh.com` and `www.truegoshengh.com` show **Valid**. In Vercel Domains, set **Redirect** apex → `www.truegoshengh.com` (or primary = www).

---

## C — Vercel Production env (paste after DNS works)

Project: `mccaesartech` / `truegoshenauto` → **Settings → Environment Variables → Production**.

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SITE_URL` | `https://www.truegoshengh.com` |
| `NEXT_PUBLIC_AUTO_SITE_URL` | `https://www.truegoshengh.com` (optional; omit to use same default) |
| `WEBAUTHN_RP_ID` | `www.truegoshengh.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | Keep `https://ddrknhvkhmgdtavpuiiq.supabase.co` until Custom Domain HTTPS is healthy; then `https://auth.truegoshengh.com` (see `docs/SUPABASE_AUTH_DOMAIN.md`) |
| `NEXT_PUBLIC_AUTH_SERVICE_URL` / `AUTH_SERVICE_URL` | Optional; do **not** set to `auth.truegoshengh.com` while TLS fails (app denylists rewrite it anyway) |
| `RESEND_FROM_EMAIL` | `noreply@truegoshengh.com` (email DNS ≠ web DNS; keep if Resend-verified) |

**Remove / leave unset for launch:**

| Name | Notes |
|------|-------|
| `PUBLIC_SITE_URL_EMERGENCY_FALLBACK` | Must be **unset** in Production for launch. Only set to `https://truegoshen.vercel.app` during a DNS outage. |

`NEXT_PUBLIC_*` changes require a redeploy to take effect in the client bundle.

**Do not** flip these while SERVFAIL / wrong apex A persist.

---

## D — Deploy

After C:

1. Redeploy Production (`vercel --prod` or Dashboard → Redeploy).
2. Confirm no Production env still points invites at `*.vercel.app`.
3. Smoke-test the go-live list below.

Prefer not deploying URL cutover until B passes. Deploying code that only prepares defaults/docs is fine anytime — if Production still needs vercel.app while DNS is broken, set `PUBLIC_SITE_URL_EMERGENCY_FALLBACK` first.

---

## E — Code: prefer custom domain (done in repo)

| Change | Status |
|--------|--------|
| Default `PRODUCTION_PUBLIC_SITE_URL` → `https://www.truegoshengh.com` | In `src/lib/site-url.ts` |
| Removed `BROKEN_PUBLIC_DNS_HOSTS` rewrite (custom domain → vercel.app) | Done |
| Legacy `*.vercel.app` hosts rewrite **to** www | Done |
| Emergency gate `PUBLIC_SITE_URL_EMERGENCY_FALLBACK` | Optional, short-lived only |
| `.env.example` targets www + `WEBAUTHN_RP_ID=www.truegoshengh.com` | Done |

If DNS breaks again after launch: set Production `PUBLIC_SITE_URL_EMERGENCY_FALLBACK=https://truegoshen.vercel.app`, redeploy, then remove it when DNS recovers.

---

## Root cause (confirmed)

| Check | Result |
|-------|--------|
| Vercel project domains | `truegoshengh.com`, `www.truegoshengh.com`, `truegoshen.vercel.app` on `mccaesartech/truegoshenauto` |
| Registrar | Namecheap, Inc. (IANA 1068) |
| Nameservers | `dns1.registrar-servers.com`, `dns2.registrar-servers.com` (Namecheap BasicDNS) |
| Public resolvers (1.1.1.1 / 8.8.8.8) | **SERVFAIL** — Google: DNSSEC validation failure |
| Parent DS (`.com`) | Present: `26933 13 1 BB50C7104790828FD6BCE3186D9E3B78951A1901` |
| Zone DNSKEY | **Missing** (authoritative NS return SOA only) |
| Apex A (checking disabled) | Often still `216.198.79.1` — **wrong** (not Vercel) |
| www CNAME (checking disabled) | `cname.vercel-dns.com` — **correct** |

**Primary blocker:** DNSSEC half-enabled — DS at registry without DNSKEY in zone.

**Secondary:** Apex `@` must be `76.76.21.21` after DNSSEC stops failing.

---

## Immediate invite workaround (pre-cutover only)

If an invite email still links to `https://truegoshengh.com/...` or `https://www.truegoshengh.com/...` while DNS is broken:

1. Copy the full path including the token.
2. Open it on the working host: `https://truegoshen.vercel.app/admin/platform/invite/<token>`
3. Do not change the path or token — only replace the hostname.

---

## Email vs web DNS

Resend (`RESEND_FROM_EMAIL=noreply@truegoshengh.com`) uses **email** DNS (SPF/DKIM/MX). That can succeed while **web** DNS still SERVFAILs. Do not assume Resend "Verified" means browsers can open `https://www.truegoshengh.com`. See `docs/EMAIL_DELIVERY.md`.

`auth.truegoshengh.com` is under the same broken DNSSEC zone — it also SERVFAILs for validating resolvers until A1 is done.

---

## Optional later: re-enable DNSSEC cleanly

Only after web DNS works:

1. On Namecheap BasicDNS, enable DNSSEC so the zone publishes DNSKEY **and** Namecheap submits a matching DS.
2. Or leave DNSSEC off if you do not need it.

Never leave a DS at the registry without a matching DNSKEY in the zone.

---

## Go-live verification

1. **Home:** `https://www.truegoshengh.com` loads; apex redirects to www; no `*.vercel.app` in address bar for public browsing.
2. **Invite:** Send a fresh platform invite → email/WhatsApp/`inviteLink` uses `https://www.truegoshengh.com/admin/platform/invite/...` and opens without rewriting to vercel.app.
3. **Admin login:** `https://www.truegoshengh.com/admin` — password + passkey (RP ID `www.truegoshengh.com`).
4. **Auth:** Customer Google works today via `*.supabase.co`; branded `auth.truegoshengh.com` only after Custom Domain TLS is healthy (`docs/SUPABASE_AUTH_DOMAIN.md`). App callback remains `https://www.truegoshengh.com/auth/callback`.
5. **Metadata:** View page source / OG tags — `og:url` / canonical use www, not vercel.app.