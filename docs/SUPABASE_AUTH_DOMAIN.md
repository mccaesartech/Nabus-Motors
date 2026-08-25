# Supabase custom auth domain (hide `*.supabase.co` on Google)

Use this runbook when Google’s account picker says **“Continue to
`ddrknhvkhmgdtavpuiiq.supabase.co`”** instead of your brand.

Google shows the **host of the OAuth redirect URI** registered for your Google
Web client. With default Supabase Auth, that URI is always on
`*.supabase.co`. Changing Next.js code or `redirectTo` **cannot** change that
host — only **Supabase Custom Domain** (plus env + redeploy) can.

**Related:** [GOOGLE_AUTH.md](./GOOGLE_AUTH.md) · public DNS cutover: [LAUNCH_DOMAIN_CUTOVER.md](../LAUNCH_DOMAIN_CUTOVER.md)

---

## Chosen configuration (copy-paste)

| Where | Value |
|-------|--------|
| **Supabase Custom Domain** | `auth.truegoshengh.com` |
| **Google — Authorized redirect URIs** | `https://ddrknhvkhmgdtavpuiiq.supabase.co/auth/v1/callback` (keep during cutover) |
| | `https://auth.truegoshengh.com/auth/v1/callback` (**required** — Custom Domain Active) |
| **Google — Authorized JavaScript origins** | `https://auth.truegoshengh.com`, `https://www.truegoshengh.com` |
| **Vercel — `NEXT_PUBLIC_SUPABASE_URL`** | `https://auth.truegoshengh.com` |
| **Supabase — Site URL** | `https://www.truegoshengh.com` (**must not** be `*.vercel.app` — that is the usual reason Google login lands on the Vercel host) |
| **Canonical app URL (`NEXT_PUBLIC_SITE_URL`)** | `https://www.truegoshengh.com` |

**Supabase → Authentication → URL Configuration → Redirect URLs** (app return path — keep these regardless of custom domain):

```
https://www.truegoshengh.com/auth/callback
https://truegoshengh.com/auth/callback
http://localhost:3000/auth/callback
https://www.truegoshengh.com/**
```

Optional legacy (app now 308-redirects `truegoshen.vercel.app` → www):

```
https://truegoshen.vercel.app/auth/callback
```
---

## Namecheap DNS (required for Custom Domain)

Registrar: Namecheap BasicDNS (`dns1.registrar-servers.com` / `dns2.registrar-servers.com`).

Under **Domain List → truegoshengh.com → Advanced DNS → Host Records**:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| **CNAME** | `auth` | `ddrknhvkhmgdtavpuiiq.supabase.co.` | Automatic (or 5–30 min) |

Optional during Supabase ownership / cert verification (Dashboard or `supabase domains create` shows exact values):

| Type | Host | Value | TTL |
|------|------|-------|-----|
| **TXT** | `_acme-challenge.auth` | *(value from Supabase Custom Domains UI / CLI)* | Automatic |

Notes:

- Namecheap often appends `.truegoshengh.com` — enter Host as `auth`, **not** `auth.truegoshengh.com`.
- Do **not** proxy `auth` through Cloudflare for this hostname (Namecheap BasicDNS is fine; avoid an extra orange-cloud proxy in front of Supabase’s edge).
- Keep web records (`@` → Vercel, `www` → Vercel) and email SPF/DKIM untouched.
- DNSSEC: zone currently publishes **DS + DNSKEY** (alg 13). If public resolvers SERVFAIL, fix DNSSEC first (see launch cutover). Validating resolvers currently resolve `auth` successfully.

### DNS probe (2026-08-03 ~21:55 UTC re-probe)

| Check | Result |
|-------|--------|
| `auth.truegoshengh.com` CNAME | → `ddrknhvkhmgdtavpuiiq.supabase.co` **OK** |
| Resolved A (via CNAME) | Cloudflare `172.64.149.246`, `104.18.38.10` |
| `_acme-challenge.auth` TXT | **NXDOMAIN** (Status 3 on Google DoH — no challenge published) |
| CAA (`truegoshengh.com`) | **none** (no Answer; not blocking issuance) |
| DNSSEC | DS (alg 13) + 2 DNSKEY; DoH `AD=true` |

**DNS is not the current blocker.** TLS/cert on the custom hostname is. CLI `supabase domains *` blocked: not logged in (`Access token not provided`).

---

## Health gate before switching Vercel

Point Production `NEXT_PUBLIC_SUPABASE_URL` at the custom domain only when
all of these pass:

1. DNS: `auth.truegoshengh.com` CNAME → this Supabase project (**already OK**)
2. HTTPS: `curl -I https://auth.truegoshengh.com/auth/v1/health` succeeds (not TLS abort)
3. Supabase Dashboard → Custom Domains shows **Active**
4. Google OAuth client includes `https://auth.truegoshengh.com/auth/v1/callback`

### Current TLS status (2026-08-03 ~22:35 UTC re-probe)

| Host | Result |
|------|--------|
| `https://ddrknhvkhmgdtavpuiiq.supabase.co/auth/v1/health` | **TLS OK** — HTTP 401 without API key is expected |
| `https://auth.truegoshengh.com/auth/v1/health` | **TLS OK** — HTTP 401 without API key; `sb-project-ref: ddrknhvkhmgdtavpuiiq` |

**Live Google OAuth (pre-cutover):** even while the browser client still preconnected to
`*.supabase.co`, Google’s error page reported:

`redirect_uri=https://auth.truegoshengh.com/auth/v1/callback`

So Custom Domain activation already changed the Google callback host. Google Cloud
**must** list that URI (app code alone cannot fix `redirect_uri_mismatch`).

App safety nets (`BROKEN_*` denylists that rewrote `auth.truegoshengh.com` →
`*.supabase.co`) are **removed** now that TLS is healthy.

Never leave Production `NEXT_PUBLIC_SUPABASE_URL` empty — empty builds disable browser Auth.

---

## Exact user checklist (TLS still broken — do this in dashboards)

Code/CLI alone cannot mint the Cloudflare/Supabase edge cert for `auth.truegoshengh.com`. Complete:

### 1. Supabase → Custom Domains

1. Open [Project Settings → Custom Domains](https://supabase.com/dashboard/project/ddrknhvkhmgdtavpuiiq/settings/general) (or Add-ons → Custom Domain).
2. Confirm add-on is enabled (paid plan).
3. Hostname: `auth.truegoshengh.com`.
4. Ensure Namecheap CNAME matches the target Supabase shows (usually `ddrknhvkhmgdtavpuiiq.supabase.co`).
5. Add any **TXT** verification / `_acme-challenge.auth` record Supabase displays.
6. Run **Reverify** (Dashboard) or CLI:
   ```bash
   npx supabase login
   npx supabase domains reverify --project-ref ddrknhvkhmgdtavpuiiq
   ```
7. Wait up to ~30 minutes for certificate issuance.
8. If status stays broken: **delete** the custom domain, wait a few minutes, **re-create** it (forces new cert), then re-add TXT if asked.
9. Gate: `curl -I https://auth.truegoshengh.com/auth/v1/health` must not fail TLS.
10. Only when HTTPS works: **Activate** the custom domain (`domains activate`).

**If Custom Domain is Active but TLS is still broken:** deactivate/remove it immediately so OAuth stays on `*.supabase.co`. An Active-but-broken host can break Google login.

### 2. Google Cloud → OAuth Web client

Only after step 1 HTTPS is healthy:

| Field | Action |
|-------|--------|
| Authorized redirect URIs | **Keep** `https://ddrknhvkhmgdtavpuiiq.supabase.co/auth/v1/callback` |
| | **Add** `https://auth.truegoshengh.com/auth/v1/callback` |
| Authorized JavaScript origins | Keep `https://www.truegoshengh.com` (and apex / vercel / localhost as today) |

Until TLS works: do **not** rely on the `auth.` redirect URI; remove it if Google already has it and Auth still advertises the broken host.

### 3. Vercel Production (only after health gate)

1. Set `NEXT_PUBLIC_SUPABASE_URL=https://auth.truegoshengh.com`
2. Redeploy Production (`NEXT_PUBLIC_*` is build-time).
3. Remove `auth.truegoshengh.com` from `BROKEN_*` denylists in code and redeploy again.
4. Smoke-test Google: account chooser must say **auth.truegoshengh.com**, then land on `https://www.truegoshengh.com/auth/callback`.

### 4. Keep Supabase Auth redirect allow-list

Do **not** remove `https://www.truegoshengh.com/auth/callback` from Supabase **Redirect URLs** — that is the app callback after Google, not the Google→Supabase callback.

---

## If browsers still open broken `auth.truegoshengh.com`

1. Confirm Vercel Production `NEXT_PUBLIC_SUPABASE_URL` is the `*.supabase.co` URL
2. Redeploy
3. Supabase Custom Domains: remove/disable until HTTPS healthy
4. Google OAuth client: keep only `…supabase.co/auth/v1/callback` until SSL works
5. Hard-refresh `/login` and confirm Google’s `redirect_uri` is `…supabase.co/auth/v1/callback`

---

## Project facts

| Item | Value |
|------|--------|
| Supabase **project ref** | `ddrknhvkhmgdtavpuiiq` |
| Default Supabase URL | `https://ddrknhvkhmgdtavpuiiq.supabase.co` |
| Google OAuth redirect (default) | `https://ddrknhvkhmgdtavpuiiq.supabase.co/auth/v1/callback` |
| Vercel project | `mccaesartech/truegoshenauto` |
| Public app | `https://www.truegoshengh.com` |
| Chosen auth hostname | `auth.truegoshengh.com` |
| Can switch app to branded URL today? | **No** — TLS handshake still fails |
