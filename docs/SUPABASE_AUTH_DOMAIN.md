# Supabase custom auth domain (hide `*.supabase.co` on Google)

Use this runbook when Google’s account picker says **“Continue to
`ddrknhvkhmgdtavpuiiq.supabase.co`”** (or similar) instead of your brand.

Google shows the **host of the OAuth redirect URI** registered for your Google
Web client. With default Supabase Auth, that URI is always on
`*.supabase.co`. Changing Next.js code or `redirectTo` **cannot** change that
host — only **Supabase Custom Domain** (plus env + redeploy) can.

**Related:** [GOOGLE_AUTH.md](./GOOGLE_AUTH.md) (consent screen, Supabase
providers, redirect URLs).

---

## Chosen configuration (copy-paste)

True Goshen Auto uses **`auth.truegoshen.com`** as the Supabase custom auth
hostname. Complete Supabase Custom Domain + DNS first; only then point Vercel at
this URL and redeploy.

| Where | Value |
|-------|--------|
| **Supabase Custom Domain** | `auth.truegoshen.com` |
| **Google — Authorized redirect URIs** | `https://ddrknhvkhmgdtavpuiiq.supabase.co/auth/v1/callback` (keep) |
| | `https://auth.truegoshen.com/auth/v1/callback` (add) |
| **Vercel — `NEXT_PUBLIC_SUPABASE_URL`** (Production + Preview) | `https://auth.truegoshen.com` |
| **Supabase — Site URL** | `https://truegoshen.vercel.app` |
| **Supabase — Redirect URLs** | See list below |

**Supabase → Authentication → URL Configuration → Redirect URLs** (app
`/auth/callback`, one per line):

```
https://truegoshen.vercel.app/auth/callback
https://truegoshen.com/auth/callback
https://truegoshenauto.com/auth/callback
http://localhost:3000/auth/callback
```

Optional wildcard (same project): `https://truegoshen.vercel.app/**`

**Vercel env (Dashboard or CLI after `vercel login`):**

```powershell
npx vercel env update NEXT_PUBLIC_SUPABASE_URL production --value https://auth.truegoshen.com --yes
npx vercel env update NEXT_PUBLIC_SUPABASE_URL preview --value https://auth.truegoshen.com --yes
npx vercel --prod --yes
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` stay unchanged.
Alternate hostname `auth.truegoshenauto.com` is not used unless you change DNS
and repeat the same steps for that subdomain.

---

## True Goshen project facts (from this repo)

| Item | Value |
|------|--------|
| Supabase **project ref** | `ddrknhvkhmgdtavpuiiq` |
| Default Supabase URL | `https://ddrknhvkhmgdtavpuiiq.supabase.co` |
| Google OAuth redirect (default) | `https://ddrknhvkhmgdtavpuiiq.supabase.co/auth/v1/callback` |
| Vercel project | `mccaesartech/truegoshenauto` |
| Canonical app URL (`NEXT_PUBLIC_SITE_URL`) | `https://truegoshen.vercel.app` |
| **Chosen Supabase auth hostname** | `auth.truegoshen.com` |
| Custom domains in routing docs | `truegoshen.com`, `truegoshenauto.com`, `auto.truegoshen.com` |

**Production check:** As of the last deploy, the live site HTML still preconnects
to `ddrknhvkhmgdtavpuiiq.supabase.co` — so `NEXT_PUBLIC_SUPABASE_URL` on Vercel
is still the default URL. That is **why** Google shows Supabase.

Custom domains **cannot** be activated via API from this repo; you must use the
Supabase Dashboard (and your DNS registrar).

---

## What `*.vercel.app` cannot do

You **cannot** make Google show `truegoshen.vercel.app` as the OAuth redirect
host while using hosted Supabase Google Auth. Google’s redirect must hit
Supabase’s **`/auth/v1/callback`** endpoint, which lives on your Supabase
project host (default `*.supabase.co`, or your **custom auth subdomain**).

So:

- **`truegoshen.vercel.app` alone** → users still see `*.supabase.co` until you
  add a **custom domain you control** (e.g. `auth.truegoshen.com`).
- **Partial UX without custom domain:** polish the [Google OAuth consent
  screen](./GOOGLE_AUTH.md#a-google-cloud--oauth-consent-screen) (app name,
  logo, homepage). Some flows emphasize the app name; Android often still shows
  the redirect host.

---

## Step 1 — Supabase: enable Custom Domain

1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/ddrknhvkhmgdtavpuiiq/settings/general) → project **ddrknhvkhmgdtavpuiiq**.
2. Go to **Project Settings → Custom Domains** (or **Add-ons → Custom Domain**).
3. **Requires Supabase Pro** (paid) and the Custom Domain add-on where applicable.
4. Enter: **`auth.truegoshen.com`** (chosen for this project).
5. Supabase shows **DNS records** (typically a **CNAME** pointing at Supabase’s
   target, plus sometimes TXT for verification). Copy them exactly.

---

## Step 2 — DNS (registrar / Cloudflare / etc.)

At the DNS provider for **truegoshen.com**:

1. Add the **CNAME** (and any **TXT**) records Supabase displays.
2. Wait for propagation (minutes to hours).
3. In Supabase, wait until Custom Domain status is **Active** and **SSL** is
   issued (Supabase manages the certificate).

Do **not** point the auth subdomain at Vercel — it must point at Supabase.

---

## Step 3 — Google Cloud: redirect URI

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials** → your **Web** OAuth client (used in Supabase Google provider).
2. Under **Authorized redirect URIs**, **keep** the existing URI:
   - `https://ddrknhvkhmgdtavpuiiq.supabase.co/auth/v1/callback`
3. **Add**:
   - `https://auth.truegoshen.com/auth/v1/callback`
4. Save.

Optional: add `auth.truegoshen.com` under **OAuth consent screen → Authorized
domains** once DNS is live.

---

## Step 4 — Supabase: URL configuration (unchanged app callback)

**Authentication → URL Configuration**

- **Site URL:** `https://truegoshen.vercel.app` (or your primary custom app domain).
- **Redirect URLs:** include every app origin where users sign in, e.g.
  - `https://truegoshen.vercel.app/auth/callback`
  - `https://truegoshen.com/auth/callback`
  - `https://truegoshenauto.com/auth/callback`
  - `http://localhost:3000/auth/callback`

These are **your Next.js** `/auth/callback` routes, not the Google → Supabase
`/auth/v1/callback` URI.

---

## Step 5 — Vercel: point the app at the custom Supabase host

1. Vercel → **truegoshenauto** → **Settings → Environment Variables**.
2. **Production** (and Preview if you test OAuth there):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://auth.truegoshen.com`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = **unchanged** (same anon key from Supabase API settings)
   - `SUPABASE_SERVICE_ROLE_KEY` = **unchanged**
3. **Redeploy** production (`npx vercel --prod --yes` or redeploy from the Vercel UI).

Optional CLI (same values as [Chosen configuration](#chosen-configuration-copy-paste)):
`npx vercel env update NEXT_PUBLIC_SUPABASE_URL production --value https://auth.truegoshen.com --yes`

`NEXT_PUBLIC_*` values are embedded at **build time**. Changing env without
redeploying leaves the old Supabase host in the bundle.

---

## Step 6 — Verify

1. Open production `/login` on a **phone** → **Continue with Google**.
2. Account chooser should show **`auth.truegoshen.com`**, not
   `ddrknhvkhmgdtavpuiiq.supabase.co`.
3. View page source: `<link rel="preconnect" href="https://auth.truegoshen.com"`.
4. Sign-in completes and lands on `/account` (or your `redirect` target).

---

## How the app uses the URL (no extra code after DNS + env)

| Layer | Behavior |
|-------|----------|
| `src/lib/supabase/env.ts` | Accepts `https://auth.yourdomain.com` or `https://*.supabase.co` |
| `src/lib/supabase/client.ts` | Browser Auth (`signInWithOAuth`, `exchangeCodeForSession`) uses `NEXT_PUBLIC_SUPABASE_URL` |
| `src/lib/customer/google-oauth.ts` | `redirectTo` → your app `/auth/callback` on **current site origin** (not Supabase host) |
| `src/app/auth/callback/page.tsx` | Exchanges `code` with the same Supabase client |
| `src/components/layout/resource-hints.tsx` | Preconnect follows `getSupabaseUrl()` |
| Middleware | None — no Supabase host hardcoding |

After custom domain, OAuth starts on `auth.truegoshen.com`; Google’s redirect
URI matches that host; users no longer see `*.supabase.co`.

---

## Storage / images note

Existing media URLs in the database may still use
`https://ddrknhvkhmgdtavpuiiq.supabase.co/storage/...`. Those keep working.
New relative storage paths use `NEXT_PUBLIC_SUPABASE_URL`. This repo adds the
custom Supabase hostname to Next.js `images.remotePatterns` at build time when
env is set.

---

## Rollback

1. Set `NEXT_PUBLIC_SUPABASE_URL` back to
   `https://ddrknhvkhmgdtavpuiiq.supabase.co`.
2. Redeploy.
3. Google redirect URI on the default host still works if you kept it in step 3.
