# Google sign-in (customer app)

Customers can **register and sign in** with Google on `/login` and `/register`
via Supabase Auth OAuth. Platform admin login and passkeys are unchanged.

## Diagnosis: still seeing `ddrknhvkhmgdtavpuiiq.supabase.co`?

| Check | True Goshen today |
|-------|-------------------|
| Supabase project ref | `ddrknhvkhmgdtavpuiiq` |
| Default Auth / API URL | `https://ddrknhvkhmgdtavpuiiq.supabase.co` |
| Google redirect URI (what Google displays) | `https://ddrknhvkhmgdtavpuiiq.supabase.co/auth/v1/callback` |
| Production `NEXT_PUBLIC_SUPABASE_URL` | `https://auth.truegoshengh.com` (Custom Domain Active + healthy TLS) |
| Branded host | `https://auth.truegoshengh.com` — Google callback: `/auth/v1/callback` |

**Step-by-step DNS / Dashboard runbook:** [SUPABASE_AUTH_DOMAIN.md](./SUPABASE_AUTH_DOMAIN.md)

**Not a code bug:** `signInWithOAuth` and `/auth/callback` are wired correctly.
Google reads the redirect host from Supabase’s OAuth client configuration, not
from your app’s `redirectTo` (`/auth/callback` on `www.truegoshengh.com`).

**Do not** point Google login at invented NextAuth-style paths such as
`/login/google` or `/api/auth/callback/google` on the auth host. Supabase Auth
uses `/auth/v1/authorize` and `/auth/v1/callback`.

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
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Auth/API URL — Production: `https://auth.truegoshengh.com` after Custom Domain is Active; fallback `https://ddrknhvkhmgdtavpuiiq.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser); unchanged when you add a custom domain |
| `NEXT_PUBLIC_SITE_URL` | Canonical app origin: `https://www.truegoshengh.com` |

Google **Client ID** and **Client Secret** are configured in the **Supabase
dashboard**, not as Next.js env vars (unless you also use them elsewhere).

---

## Branding checklist (do all of these)

### A. Google Cloud — OAuth consent screen

1. [Google Cloud Console](https://console.cloud.google.com/) → your project →
   **APIs & Services → OAuth consent screen**
2. **User type:** External (or Internal for Workspace-only)
3. **App information**
   - **App name:** `True Goshen Auto`
   - **User support email:** your ops address
   - **App logo:** square PNG/JPG, min 120×120 px
   - **Application home page:** `https://www.truegoshengh.com`
   - **Application privacy policy** / **Terms of service:** live HTTPS URLs on your domain
   - **Authorized domains:** add:
     - `truegoshengh.com`
     - `truegoshen.vercel.app` (optional fallback)
     - `auth.truegoshengh.com` (after custom domain DNS/SSL is live)
4. **Scopes:** `email`, `profile`, `openid`
5. **Test users:** while status is **Testing**, add QA accounts
6. When ready, **Publish app** / complete verification if Google prompts

### B. Google Cloud — OAuth client (Web)

**APIs & Services → Credentials →** your Web client (or create one)

| Field | Values |
|-------|--------|
| Name | `True Goshen Supabase Auth` |
| **Authorized JavaScript origins** | `https://auth.truegoshengh.com`, `https://www.truegoshengh.com`, `https://truegoshengh.com`, `https://truegoshen.vercel.app`, `http://localhost:3000` |
| **Authorized redirect URIs** | `https://ddrknhvkhmgdtavpuiiq.supabase.co/auth/v1/callback` **keep during cutover** |
| | `https://auth.truegoshengh.com/auth/v1/callback` **required once Custom Domain is Active** |

Project ref: **`ddrknhvkhmgdtavpuiiq`**.

Copy **Client ID** and **Client Secret** into Supabase (next section).

### C. Supabase — Google provider

1. Supabase Dashboard → **Authentication → Providers → Google**
2. Enable Google; paste **Client ID** and **Client Secret**
3. Save

### D. Supabase — URL configuration

**Authentication → URL Configuration**

| Setting | Value |
|---------|--------|
| **Site URL** | `https://www.truegoshengh.com` (**must not** be `*.vercel.app`) |
| **Redirect URLs** | `https://www.truegoshengh.com/auth/callback` (**required**) |
| | `https://truegoshengh.com/auth/callback` |
| | `http://localhost:3000/auth/callback` |
| | `https://www.truegoshengh.com/**` (optional wildcard) |
| | `https://truegoshen.vercel.app/auth/callback` (legacy only; app now redirects this host → www) |

The app sends users to `/auth/callback?redirect=…` after Google; that page
exchanges the `code` for a session via `supabase.auth.exchangeCodeForSession`.
`redirectTo` is always built from the **canonical public site URL**
(`NEXT_PUBLIC_SITE_URL` → `https://www.truegoshengh.com`), never from
`window.location.origin` on `*.vercel.app`. Localhost keeps the current origin
for local testing.

**Critical:** If Supabase **Site URL** is still `https://truegoshen.vercel.app`,
Google/Supabase will send users there when `redirect_to` is missing or not
allowlisted. Set **Site URL** to `https://www.truegoshengh.com` and include
`https://www.truegoshengh.com/auth/callback` in **Redirect URLs**.

### E. Supabase Custom Domain (optional branding)

Available on **Supabase Pro** (Custom Domain add-on). This is the **only**
supported way to show your domain on Google’s OAuth screen instead of
`ddrknhvkhmgdtavpuiiq.supabase.co`.

**Current status note (2026-08-03 night):** Custom Domain `auth.truegoshengh.com`
TLS is healthy (`/auth/v1/health` responds via HTTPS; missing `apikey` → 401 is
expected). Production should use
`NEXT_PUBLIC_SUPABASE_URL=https://auth.truegoshengh.com`. Keep **both** Google
Authorized redirect URIs during cutover:

- `https://ddrknhvkhmgdtavpuiiq.supabase.co/auth/v1/callback`
- `https://auth.truegoshengh.com/auth/v1/callback`

Full checklist: **[SUPABASE_AUTH_DOMAIN.md](./SUPABASE_AUTH_DOMAIN.md)**

---

## Verify

1. Open `https://www.truegoshengh.com/login` → **Continue with Google**
2. Complete Google consent; land on `/auth/callback` then `/account` (or redirect)
3. Confirm a `profiles` row exists (name from Google metadata)

## Troubleshooting: “Account sign-in is not configured yet”

That message means the browser Supabase client is `null` — usually because
`NEXT_PUBLIC_SUPABASE_URL` and/or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are **missing
or empty on Vercel**.

1. Set Production `NEXT_PUBLIC_SUPABASE_URL=https://auth.truegoshengh.com`
2. Confirm anon + service role keys are present
3. **Redeploy** (`npx vercel --prod --yes`) — `NEXT_PUBLIC_*` are baked at build time
4. Verify homepage HTML preconnects to `https://auth.truegoshengh.com`

## Platform admin

Do **not** use this Google flow for `/platform` or `/admin` — those use platform
sessions and optional passkeys (`docs/ADMIN_PASSKEYS.md`).
