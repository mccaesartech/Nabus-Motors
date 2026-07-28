# Google sign-in (customer app)

Customers can **register and sign in** with Google on `/login` and `/register`
via Supabase Auth OAuth. Platform admin login and passkeys are unchanged.

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
   - **App name:** `True Goshen Auto`
   - **User support email:** your ops address
   - **App logo:** square brand mark (Google size requirements)
   - **Application home page:** `https://truegoshen.vercel.app`
   - **Application privacy policy** / **Terms of service:** live URLs on your domain
   - **Authorized domains:** add every domain you own and use, e.g.
     - `truegoshen.vercel.app`
     - `truegoshen.com` / `truegoshenauto.com` (if used)
     - `auth.truegoshen.com` (after custom domain DNS is live)
4. **Scopes:** `email`, `profile`, `openid` (defaults for Google sign-in)
5. **Test users:** while status is **Testing**, add accounts you use for QA
6. When ready, **Publish app** / complete **verification** if Google prompts
   (required for wide public use and stronger trust UI)

### B. Google Cloud — OAuth client (Web)

**APIs & Services → Credentials →** your Web client (or create one)

| Field | Values |
|-------|--------|
| Name | `True Goshen Supabase Auth` |
| **Authorized JavaScript origins** | `https://truegoshen.vercel.app`, custom domains you serve, `http://localhost:3000` |
| **Authorized redirect URIs** | `https://<PROJECT_REF>.supabase.co/auth/v1/callback` **always keep this** |
| | **Plus** after custom domain: `https://auth.<yourdomain>.com/auth/v1/callback` |

Find `<PROJECT_REF>` in Supabase **Project Settings → API → Project URL**.

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

### E. Supabase Custom Domain (recommended for “continue to supabase”)

Available on **Pro** (paid add-on). This is the supported way to show your
domain on Google’s OAuth screen instead of `*.supabase.co`.

1. Supabase Dashboard → **Project Settings → Custom Domains** (or
   **Add-ons → Custom Domain**)
2. Choose a subdomain dedicated to Auth/API, e.g. `auth.truegoshen.com` (not
   the same as your marketing site unless you intend to)
3. Add the DNS records Supabase shows; wait until status is **Active**
4. In **Google Cloud**, add redirect URI:
   `https://auth.truegoshen.com/auth/v1/callback` (keep the `.supabase.co`
   URI as well during migration)
5. In **Vercel** (Production), set:
   - `NEXT_PUBLIC_SUPABASE_URL=https://auth.truegoshen.com`
   - Keep `NEXT_PUBLIC_SUPABASE_ANON_KEY` the same
6. Redeploy the Next.js app

The repo accepts custom domains in `getSupabaseUrl()` (`src/lib/supabase/env.ts`).
All browser Auth traffic (including `signInWithOAuth`) then goes through your
branded host, and Google’s chooser should show that host.

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
