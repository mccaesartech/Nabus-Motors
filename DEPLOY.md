# Deploy True Goshen Auto (Vercel + Supabase)

## Step 1 — Supabase (free database)

1. Go to **[supabase.com/dashboard](https://supabase.com/dashboard)** and sign in (or create an account).
2. Click **New project**
   - Name: `true-goshen-auto`
   - Database password: choose a strong password (save it)
   - Region: pick closest to your customers (e.g. `US East`)
3. Wait ~2 minutes for the project to finish provisioning.
4. Open **SQL Editor** → **New query**
5. Copy the entire contents of `supabase/seed.sql` from this repo and click **Run**.
6. Go to **Project Settings** → **API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Step 2 — Vercel (live website)

Your Vercel account is already linked (`mccaesartech`).

### Option A — Deploy from this folder (CLI)

```powershell
cd "C:\Users\PC1\OneDrive\Desktop\True Goshen\true-goshen-auto"
vercel --prod
```

When prompted for environment variables, add:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `NEXT_PUBLIC_SITE_URL` | `https://truegoshen.vercel.app` (canonical public app URL used by invites, metadata, and email links) |
| `NEXT_PUBLIC_AUTO_SITE_URL` | `https://truegoshenauto.com` (optional — Auto Division direct entry) |
| `AUTO_DIVISION_HOSTS` | `truegoshenauto.com,truegoshenauto.vercel.app,auto.truegoshen.com` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Your WhatsApp number (digits only, e.g. `233244876784`) |

For production WhatsApp Cloud API (outbound notifications + webhook), also set
`WHATSAPP_PROVIDER=meta`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, and apply migration
`077_whatsapp_delivery_tracking.sql`. Full checklist: `docs/WHATSAPP.md`.

For **SMS via Arkesel** (preferred path), set `SMS_PROVIDER=arkesel`,
`ARKESEL_API_KEY`, and `ARKESEL_SENDER_ID`. Details: `docs/SMS.md`.

### Customer Google sign-in

Google Client ID/Secret live in the **Supabase dashboard** (Auth → Providers → Google),
not as Vercel secrets. You still need:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `NEXT_PUBLIC_SITE_URL` | `https://truegoshen.vercel.app` |

Setup steps: `docs/GOOGLE_AUTH.md` (includes Google consent-screen branding and
Supabase **Custom Domain** so mobile Google sign-in does not show `*.supabase.co`).
Email signup checks: `docs/EMAIL_VALIDATION.md`.

### Option B — Vercel Dashboard

1. Go to **[vercel.com/new](https://vercel.com/new)**
2. Import the project folder (or connect GitHub if you push the repo)
3. **Root Directory:** `true-goshen-auto` (if importing from parent folder)
4. Add the environment variables above under **Settings → Environment Variables**
5. Click **Deploy**

## Step 3 — Verify

- Open your Vercel URL (e.g. `https://true-goshen-auto-xxx.vercel.app`)
- Check **Inventory** — vehicles should load from Supabase
- Check `/api/health/live` returns `200` and `/api/health/ready` returns `200`
- Production fails closed with empty inventory and `503` readiness when required
  Supabase/admin/cron configuration is missing. Built-in demo data is local
  development only.

For CI gates, rollback, backup/restore validation, environment separation, and
monitoring setup, follow `docs/PRODUCTION_OPERATIONS_RUNBOOK.md`.

## Troubleshooting local dev

```powershell
cd "C:\Users\PC1\OneDrive\Desktop\True Goshen\true-goshen-auto"
copy .env.example .env.local
# Edit .env.local with your Supabase URL and anon key
npm run dev
```

Open **http://localhost:3000** (not 127.0.0.1 unless that works on your machine).

If port 3000 is busy:

```powershell
npx next dev -p 3001
```

## Custom domains

Add **both** domains in Vercel → your project → **Settings → Domains**:

| Domain | Purpose |
|--------|---------|
| `truegoshen.com` (+ `www.truegoshen.com`) | Corporate HQ — `/` is the main company homepage |
| `truegoshenauto.com` (+ `www`, `auto.truegoshen.com`) | Auto Division — visitors go straight to `/auto` |

The app uses one deployment. Middleware detects the hostname:

- **truegoshen.com** — normal routing (`/` = corporate, `/auto` = marketplace)
- **truegoshenauto.com** (and `truegoshenauto.vercel.app`) — `/` redirects to `/auto`; short paths like `/inventory` redirect to `/auto/inventory`

Set `NEXT_PUBLIC_SITE_URL=https://truegoshen.vercel.app` for the Production
environment in Vercel, then redeploy. Do not set it to a preview deployment or
the legacy `truegoshenauto.vercel.app` Auto Division alias. Platform invitation
links, sitemap URLs, metadata, and shared email links all use this canonical
origin.

`truegoshenauto.vercel.app` keeps working as an Auto Division entry point until you add the custom domain.
