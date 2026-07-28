# Supabase Setup — True Goshen Auto

**Account:** mccaesartechtraining@gmail.com (`mcaesartechtraining`)  
**Live site:** https://truegoshen.vercel.app
**Auto Division:** https://truegoshenauto.com (or https://truegoshenauto.vercel.app)
**Admin dashboard:** https://truegoshen.vercel.app/admin/platform/dashboard

---

## Step 1 — Create Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and sign in with **mccaesartechtraining@gmail.com**
2. Click **New project**
   - **Name:** `true-goshen-auto`
   - **Database password:** choose a strong password and save it
   - **Region:** `West EU (London)` or closest to Ghana
3. Wait ~2 minutes for provisioning

---

## Step 2 — Run database setup (SQL)

1. In Supabase, open **SQL Editor** → **New query**
2. Copy the entire contents of **`supabase/setup.sql`** from this repo → paste → **Run**
3. Open a **second query**, copy **`supabase/seed-vehicles.sql`** → paste → **Run**

You should see **75 vehicles** in **Table Editor → vehicles**.

To regenerate the seed after inventory changes:

```powershell
npx tsx scripts/generate-supabase-seed.ts
```

---

## Step 3 — Copy API keys

Go to **Project Settings → API** and copy:

| Key | Env variable |
|-----|----------------|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| anon public | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| service_role (secret) | `SUPABASE_SERVICE_ROLE_KEY` |

> **Never** expose `service_role` in the browser. It is server-only (admin dashboard).

---

## Step 4 — Add env vars to Vercel

1. Go to [vercel.com](https://vercel.com) → project **truegoshenauto** → **Settings → Environment Variables**
2. Add these for **Production**:

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbG...` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbG...` (service role) |
| `NEXT_PUBLIC_SITE_URL` | `https://truegoshen.vercel.app` |
| `NEXT_PUBLIC_AUTO_SITE_URL` | `https://truegoshenauto.com` (optional) |
| `AUTO_DIVISION_HOSTS` | `truegoshenauto.com,truegoshenauto.vercel.app` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | `233244876784` |
| `ADMIN_PASSWORD` | your strong admin password |
| `ADMIN_SECRET` | random secret string |
| `RESEND_API_KEY` | API key from [resend.com](https://resend.com) |
| `RESEND_FROM_EMAIL` | `True Goshen <noreply@yourdomain.com>` — **must use a verified domain** (not `onboarding@resend.dev`, which only delivers to the Resend account owner) |

3. **Redeploy** (Deployments → ⋯ → Redeploy)

---

## Step 4c — Email delivery (password reset & notifications)

**Option A — Resend (branded customer emails)**

1. Add and verify your domain at [resend.com/domains](https://resend.com/domains)
2. Set `RESEND_FROM_EMAIL` to an address on that domain, e.g. `True Goshen <noreply@truegoshen.com>`
3. Do **not** use `onboarding@resend.dev` in production — it only sends to the Resend signup email. Platform → Settings shows a red banner when sandbox is detected.

**Option B — Supabase Auth SMTP (primary for password reset)**

Password reset tries **Supabase `resetPasswordForEmail` first** (uses your project SMTP), then Resend as a branded fallback with the action link.

1. **Project Settings → Authentication → SMTP Settings** — enable custom SMTP (SendGrid, Resend SMTP, etc.) or use Supabase default (rate-limited)
2. **Authentication → Email Templates → Reset Password** — ensure the template is enabled
3. **Authentication → URL Configuration** — Site URL and redirect URLs must match production (see Step 4b)

To test **today without domain verification**: configure Supabase SMTP (even Supabase's built-in mail) and request a reset — the app uses that path before Resend.

---

## Step 4b — Auth URL configuration (password reset + Google OAuth)

In Supabase: **Authentication → URL Configuration**

| Setting | Value |
|---------|--------|
| **Site URL** | `https://truegoshen.vercel.app` |
| **Redirect URLs** | `https://truegoshen.vercel.app/auth/callback` |
| **Redirect URLs** | `https://truegoshen.vercel.app/reset-password` |
| | `https://truegoshenauto.com/auth/callback` |
| | `https://truegoshenauto.com/reset-password` |
| | `https://truegoshenauto.com/**` (optional wildcard) |
| | `http://localhost:3000/auth/callback` (local Google OAuth) |

If **Site URL** is `http://localhost:3000`, password-reset emails will send users to localhost even in production. After changing these values, request a **new** reset email — old links keep the previous redirect.

The app builds reset links with `redirectTo` = `{site}/reset-password` using `NEXT_PUBLIC_AUTO_SITE_URL`, then Vercel production URL, then `https://truegoshen.vercel.app` — never localhost outside `npm run dev`.

### Google sign-in (customer `/login` + `/register`)

1. Create a Google Cloud **OAuth Web client** and set the authorized redirect URI to
   `https://<PROJECT_REF>.supabase.co/auth/v1/callback`.
2. Supabase → **Authentication → Providers → Google** — enable and paste Client ID + Secret.
3. Full checklist: **`docs/GOOGLE_AUTH.md`**.

Signup email checks (format, disposable domains, MX): **`docs/EMAIL_VALIDATION.md`**.

Platform team invitations do not use Supabase Auth email templates or its Site
URL. The application creates a token in `platform_user_invites`, sends
`{NEXT_PUBLIC_SITE_URL}/admin/platform/invite/{token}`, validates it through the admin
invite API, and establishes the platform session cookie after acceptance.

---

## Step 5 — Local development

```powershell
cd "C:\Users\PC1\OneDrive\Desktop\True Goshen\true-goshen-auto"
copy .env.example .env.local
```

Edit `.env.local` with your Supabase keys and admin password, then:

```powershell
npm run dev
```

- Public site: http://localhost:3000
- Admin login: http://localhost:3000/admin

---

## Admin dashboard features

After Supabase is connected, log in at `/admin` with your `ADMIN_PASSWORD`:

| Tab | What you can do |
|-----|-----------------|
| **Overview** | Vehicle counts, new leads, pending finance/appraisal stats |
| **Vehicles** | Change status (available/sold/reserved), toggle featured, view listing |
| **Inquiries** | Contact, vehicle, finance, appraisal, newsletter — update lead status |

---

## Database tables

| Table | Purpose |
|-------|---------|
| `vehicles` | 75-car inventory (Chinese + international) |
| `contact_inquiries` | Contact form submissions |
| `vehicle_inquiries` | Purchase / test drive / rental requests |
| `finance_applications` | Financing pre-qualification |
| `appraisal_requests` | Sell / trade-in requests |
| `newsletter_subscribers` | Email newsletter signups |
| `profiles` | User profiles (future auth) |
| `saved_vehicles` | User garage (future auth) |

---

## Troubleshooting

**Site loads but inventory is demo data**  
→ Supabase URL/anon key missing on Vercel. Redeploy after adding them.

**Admin shows “Supabase not connected”**  
→ Add `SUPABASE_SERVICE_ROLE_KEY` on Vercel and redeploy.

**SQL errors on setup.sql**  
→ Safe to re-run; uses `IF NOT EXISTS` and `DROP POLICY IF EXISTS`.

**Need to refresh vehicle seed**  
→ Run `npx tsx scripts/generate-supabase-seed.ts`, then re-run `seed-vehicles.sql` in SQL Editor.
