# Google sign-in (customer app)

Customers can **register and sign in** with Google on `/login` and `/register`
via Supabase Auth OAuth. Platform admin login and passkeys are unchanged.

## Diagnosis: still seeing `ddrknhvkhmgdtavpuiiq.supabase.co`?

| Check | True Goshen today |
|-------|-------------------|
| Supabase project ref | `ddrknhvkhmgdtavpuiiq` |
| Default Auth / API URL | `https://ddrknhvkhmgdtavpuiiq.supabase.co` |
| Google redirect URI (what Google displays) | `https://ddrknhvkhmgdtavpuiiq.supabase.co/auth/v1/callback` |
| Production `NEXT_PUBLIC_SUPABASE_URL` | Still the default `*.supabase.co` URL (live HTML preconnect confirms) |
| Fix that removes Supabase from Google’s screen | **Supabase Custom Domain** + Google redirect URI + Vercel env + **redeploy** |

**Step-by-step DNS / Dashboard runbook:** [SUPABASE_AUTH_DOMAIN.md](./SUPABASE_AUTH_DOMAIN.md)

**Not a code bug:** `signInWithOAuth` and `/auth/callback` are wired correctly.
Google reads the redirect host from Supabase’s OAuth client configuration, not
from your app’s `redirectTo` (`/auth/callback` on `truegoshen.vercel.app`).

**`truegoshen.vercel.app` cannot replace `*.supabase.co` on the Google screen**
without a custom auth subdomain on a domain you own (e.g. `auth.truegoshen.com`).
See [SUPABASE_AUTH_DOMAIN.md § vercel.app](./SUPABASE_AUTH_DOMAIN.md#what-vercelapp-cannot-do).

---

## App pieces (already wired)

| Piece | Path |
|-------|------|
| Continue with Google button | `src/components/customer/google-sign-in-button.tsx` |
| OAuth start helper | `src/lib/customer/google-oauth.ts` |
| Auth callback (code exchange) | `src/app/auth/callback/page.tsx` |
| Profile on first login | DB trigger `handle_new_customer` + `/api/customer/sync-account` |

## Env vars (Vercel / `.env.local`)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL — use your **Custom Domain** URL in production when configured (see below) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser); unchanged when you add a custom domain |
| `NEXT_PUBLIC_SITE_URL` | Canonical app origin for metadata, invites, and OAuth callback fallback (e.g. `https://truegoshen.vercel.app`) |

Google **Client ID** and **Client Secret** are configured in the **Supabase
dashboard**, not as Next.js env vars (unless you also use them elsewhere).

The browser Supabase client reads `NEXT_PUBLIC_SUPABASE_URL` for all Auth
requests. After you activate a Supabase **Custom Domain**, set this env var to
that domain (e.g. `https://auth.truegoshen.com`) and redeploy so OAuth and
token refresh use the branded host.

---

## Why Google shows “continue to …supabase.co” on phone

Google’s account chooser shows the **OAuth redirect target** — the host of the
callback URL registered for your Google OAuth client. With hosted Supabase Auth,
that callback is always:

`https://<project-ref>.supabase.co/auth/v1/callback`

So users often see `continue to abcdefghijk.supabase.co` (especially on Android),
even if your site is True Goshen. That string is **not controlled by Next.js
query params**; it comes from Google + Supabase’s Auth endpoint.

What helps:

| Approach | Effect |
|----------|--------|
| **Google OAuth consent screen** (app name, logo, homepage, verified domain) | Can show **True Goshen Auto** in some flows; users may still see the Supabase host when Google emphasizes the redirect URI |
| **Supabase Custom Domain for Auth** (Pro plan add-on) | Replaces `*.supabase.co` in the OAuth callback Google sees — e.g. `continue to auth.truegoshen.com` |
| **Supabase Site URL** | Controls where Supabase sends users **after** Google; does **not** change the Google chooser host text |

There is no Supabase Dashboard toggle that rewrites the Google chooser without
a custom domain. `skipBrowserRedirect` only changes how the app starts OAuth
(server PKCE); it does not change branding.

Official references:

- [Supabase — Google social login](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase — Custom domains](https://supabase.com/docs/guides/platform/custom-domains)

---

## Branding checklist (do all of these)

### A. Google Cloud — OAuth consent screen

1. [Google Cloud Console](https://console.cloud.google.com/) → your project →
   **APIs & Services → OAuth consent screen**
2. **User type:** External (or Internal for Workspace-only)
3. **App information**
   - **App name:** `True Goshen Auto` (this is what many users see as the app title)
   - **User support email:** your ops address
   - **App logo:** square PNG/JPG, min 120×120 px (Google requirements); use brand mark
   - **Application home page:** `https://truegoshen.vercel.app` (or `https://truegoshen.com`)
   - **Application privacy policy** / **Terms of service:** live HTTPS URLs on your domain
   - **Authorized domains:** add every domain you own and use, e.g.
     - `truegoshen.vercel.app`
     - `truegoshen.com` / `truegoshenauto.com`
     - `auth.truegoshen.com` (after custom domain DNS is live)
4. **Scopes:** `email`, `profile`, `openid` (defaults for Google sign-in)
5. **Test users:** while status is **Testing**, add accounts you use for QA
6. When ready, **Publish app** / complete **verification** if Google prompts
   (required for wide public use and stronger trust UI)

**Partial branding only:** a strong consent screen improves trust but **does not**
remove `*.supabase.co` from the account picker on all devices. For that, complete
section **E** / [SUPABASE_AUTH_DOMAIN.md](./SUPABASE_AUTH_DOMAIN.md).

### B. Google Cloud — OAuth client (Web)

**APIs & Services → Credentials →** your Web client (or create one)

| Field | Values |
|-------|--------|
| Name | `True Goshen Supabase Auth` |
| **Authorized JavaScript origins** | `https://truegoshen.vercel.app`, custom domains you serve, `http://localhost:3000` |
| **Authorized redirect URIs** | `https://ddrknhvkhmgdtavpuiiq.supabase.co/auth/v1/callback` **always keep this** |
| | **Plus** after custom domain: `https://auth.truegoshen.com/auth/v1/callback` (or `auth.truegoshenauto.com`) |

Project ref for this app: **`ddrknhvkhmgdtavpuiiq`** (Supabase **Project Settings → API**).

Copy **Client ID** and **Client Secret** into Supabase (next section).

### C. Supabase — Google provider

1. Supabase Dashboard → **Authentication → Providers → Google**
2. Enable Google; paste **Client ID** and **Client Secret**
3. Save

### D. Supabase — URL configuration

**Authentication → URL Configuration**

| Setting | Value |
|---------|--------|
| **Site URL** | `https://truegoshen.vercel.app` |
| **Redirect URLs** | `https://truegoshen.vercel.app/auth/callback` |
| | `https://truegoshen.vercel.app/**` (optional wildcard) |
| | Production custom domains, e.g. `https://truegoshenauto.com/auth/callback` |
| | `http://localhost:3000/auth/callback` |

The app sends users to `/auth/callback?redirect=…` after Google; that page
exchanges the `code` for a session via `supabase.auth.exchangeCodeForSession`.
`redirectTo` is built from the **current browser origin** (or
`NEXT_PUBLIC_SITE_URL` as fallback) in `buildOAuthCallbackUrl()`.

### E. Supabase Custom Domain (required to hide `*.supabase.co` on Google)

Available on **Supabase Pro** (Custom Domain add-on). This is the **only**
supported way to show your domain on Google’s OAuth screen instead of
`ddrknhvkhmgdtavpuiiq.supabase.co`.

Full checklist (DNS CNAME, SSL, Google URI, Vercel env, verify on phone):
**[SUPABASE_AUTH_DOMAIN.md](./SUPABASE_AUTH_DOMAIN.md)**

Summary:

1. Supabase → **Custom Domains** → e.g. `auth.truegoshen.com` → add DNS → **Active**
2. Google → add redirect URI `https://auth.truegoshen.com/auth/v1/callback`
3. Vercel → `NEXT_PUBLIC_SUPABASE_URL=https://auth.truegoshen.com` → **redeploy**

The repo accepts custom domains in `getSupabaseUrl()` (`src/lib/supabase/env.ts`).
All browser Auth traffic (including `signInWithOAuth`) then uses that host, and
Google’s chooser should show it.

**Note:** SAML Entity IDs change when you enable a custom domain; Google OAuth
is unaffected beyond redirect URIs.

---

## 1. Create a Google Cloud OAuth client (quick steps)

1. Open [Google Cloud Console](https://console.cloud.google.com/) → select or
   create a project.
2. Complete the **Branding checklist** sections A–B above.
3. **Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
4. Copy the **Client ID** and **Client Secret**.

## 2. Enable Google in Supabase Auth

1. Supabase Dashboard → **Authentication → Providers → Google**
2. Enable Google
3. Paste **Client ID** and **Client Secret**
4. Save

## 3. Supabase redirect URLs

See section **D** above.

## 4. Verify

1. Open `/register` or `/login` on a **phone** → **Continue with Google**
2. Confirm the account chooser shows **True Goshen Auto** and/or your **custom
   auth domain**, not a random `*.supabase.co` string (after custom domain +
   redeploy)
3. Land on `/account` (or the `redirect` target) with a `profiles` row
   (name from Google metadata, `registration_id` from trigger)

## Linking email + Google

If a customer already registered with email/password using the **same Google
email**, Supabase account linking depends on project Auth settings (automatic
linking / manual identity link). Prefer enabling **automatic linking** for the
same verified email in Supabase Auth when available, or ask users to sign in
with the original method and link identities later.

## Platform admin

Do **not** use this Google flow for `/platform` or `/admin` — those use platform
sessions and optional passkeys (`docs/ADMIN_PASSKEYS.md`).

## Troubleshooting: “Account sign-in is not configured yet”

That message means the browser Supabase client is `null` — usually because
`NEXT_PUBLIC_SUPABASE_URL` and/or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are **missing
or empty on Vercel** (not embedded in the client bundle after build).

1. **Vercel** → project **truegoshenauto** → **Settings → Environment Variables**
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://ddrknhvkhmgdtavpuiiq.supabase.co` (or your custom auth domain)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public key from Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` = service role (server only)
2. Or locally: copy `.env.supabase-restore.example` → `.env.supabase-restore`, paste keys, run `node scripts/restore-vercel-supabase-env.mjs`
3. **Redeploy** production (`npx vercel --prod --yes`). `NEXT_PUBLIC_*` values are baked in at build time.
4. Verify: homepage HTML includes `<link rel="preconnect" href="https://….supabase.co"` (or your auth domain).

Custom-domain URL validation lives in `src/lib/supabase/env.ts`. The URL must be
`https://` with no path (not the Supabase dashboard link).

