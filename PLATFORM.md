# True Goshen Auto — Platform Links & Backend Guide

## Live website (Vercel)

| Resource | URL |
|----------|-----|
| **Public website** | https://true-goshen-auto.vercel.app |
| **Vercel project dashboard** | https://vercel.com/mc-caesar-te-chnology-solutions/true-goshen-auto |
| **Vercel account** | `mccaesartech` / team `mc-caesar-te-chnology-solutions` |

Deploy from your PC:

```powershell
cd "C:\Users\PC1\OneDrive\Desktop\True Goshen\true-goshen-auto"
vercel --yes --prod --scope mc-caesar-te-chnology-solutions
```

---

## GitHub (source code)

GitHub is **not connected yet**. To link it:

1. Create a repo on GitHub (e.g. `true-goshen-auto`).
2. In the project folder:

```powershell
cd "C:\Users\PC1\OneDrive\Desktop\True Goshen\true-goshen-auto"
git remote add origin https://github.com/YOUR_USERNAME/true-goshen-auto.git
git add .
git commit -m "True Goshen Auto platform"
git push -u origin master
```

3. In **Vercel** → **Settings** → **Git** → connect the GitHub repo for automatic deploys on push.

---

## Backend & database (Supabase)

All customer actions are stored in **Supabase** (PostgreSQL):

| What | Supabase table |
|------|----------------|
| Vehicle inventory | `vehicles` |
| Contact messages | `contact_inquiries` |
| Buy / test drive / rental interest | `vehicle_inquiries` |
| Financing applications | `finance_applications` |
| Sell / trade-in appraisals | `appraisal_requests` |
| Newsletter sign-ups | `newsletter_subscribers` |
| Saved vehicles (logged-in users) | `saved_vehicles` |
| User profiles | `profiles` |

**Supabase dashboard:** https://supabase.com/dashboard  

Setup:

1. Create a project at supabase.com.
2. Run SQL from:
   - `supabase/migrations/001_initial.sql`
   - `supabase/migrations/002_inquiries.sql`
   - `supabase/seed.sql` (optional sample vehicles)
3. Copy **Project URL** and **anon key** → Vercel env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Copy **service role key** (Settings → API) → Vercel env var:
   - `SUPABASE_SERVICE_ROLE_KEY` (admin dashboard only — keep secret)

Without Supabase, the site uses **generated demo inventory** (~1,000+ vehicles) and form submissions are logged on the server only.

---

## Hidden admin dashboard (NOT on public website)

| Resource | URL |
|----------|-----|
| **Admin login** | https://true-goshen-auto.vercel.app/tg-console-8f2k |
| **Admin dashboard** | https://true-goshen-auto.vercel.app/tg-console-8f2k/dashboard |

Local:

- http://localhost:3000/tg-console-8f2k

**Not linked** from the header, footer, or any public page. Blocked in `robots.txt`.

Set in Vercel / `.env.local`:

```
ADMIN_PATH=tg-console-8f2k
ADMIN_PASSWORD=your-strong-password
ADMIN_SECRET=random-secret-string
```

---

## Inventory size

| Category | Count |
|----------|-------|
| **Chinese brands** | ~100 vehicles |
| **Each international brand** | 50 vehicles each (BMW, Toyota, Ford, etc.) |
| **Total inventory** | ~1,050 vehicles |

Filter by brand on `/inventory?make=BYD` to see all vehicles for that make.

---

## Environment variables checklist (Vercel)

| Variable | Required for |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Database |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Database + forms |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin dashboard |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | WhatsApp button |
| `NEXT_PUBLIC_SITE_URL` | SEO / links |
| `ADMIN_PASSWORD` | Admin login |
| `ADMIN_SECRET` | Admin session security |
| `ADMIN_PATH` | Optional — change admin URL path |
