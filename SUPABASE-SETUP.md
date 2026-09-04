# Supabase Setup — Nabus Motors

**Project name:** `nabus-motors` (or your chosen name)  
**Live site (when deployed):** https://www.nabusmotors.com  
**Admin dashboard:** `/admin/platform/dashboard`

---

## Step 1 — Create Supabase project ✅

You already created the project. Keep these handy from **Project Settings → API**:

| Key | Env variable |
|-----|----------------|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| anon public | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| service_role (secret) | `SUPABASE_SERVICE_ROLE_KEY` |

> Never expose `service_role` in the browser — server/admin only.

---

## Step 2 — Run database setup (SQL)

### Option A — One file (recommended for fresh project)

1. Open **`supabase/nabus-full-setup.sql`** in Cursor
2. Select all → Copy
3. Supabase Dashboard → **SQL Editor** → **New query** → Paste → **Run**
4. Wait for success (may take 1–2 minutes)

### Option B — Manual two-step (legacy)

1. Run **`supabase/setup.sql`**
2. Run every file in **`supabase/migrations/`** in numeric order (001 → 103)

---

## Step 3 — Seed vehicle inventory

1. Open **`supabase/seed-vehicles.sql`**
2. Copy entire file → Supabase **SQL Editor** → **New query** → **Run**
3. Confirm in **Table Editor → vehicles** — you should see **75 rows**

To regenerate the seed after inventory changes:

```powershell
npm run db:seed
```

Then re-run `seed-vehicles.sql` in the SQL Editor.

---

## Step 4 — Local environment (`.env.local`)

```powershell
cd "C:\Users\PC1\OneDrive\Desktop\Nabus\truegoshenauto"
copy .env.example .env.local
```

Edit `.env.local` and paste your Supabase keys:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_WHATSAPP_NUMBER=233279940200

ADMIN_PASSWORD=your-strong-admin-password
ADMIN_SECRET=your-random-secret-string
```

Start locally:

```powershell
npm run dev
```

- Site: http://localhost:3000  
- Admin: http://localhost:3000/admin  

---

## Step 5 — Vercel environment variables

In your Vercel project → **Settings → Environment Variables**, add for **Production** and **Preview**:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `NEXT_PUBLIC_SITE_URL` | `https://www.nabusmotors.com` (or your Vercel URL until domain is ready) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | `233279940200` |
| `ADMIN_PASSWORD` | Strong admin password |
| `ADMIN_SECRET` | Random secret string |

Redeploy after saving env vars.

---

## Step 6 — Verify connection

After `.env.local` is filled in:

```powershell
npm run dev
```

- Open **Inventory** — vehicles should load from Supabase (not demo fallback)
- Visit `/api/health/ready` — should return `200` when Supabase is connected

---

## Troubleshooting

**Inventory shows demo data locally**  
→ Supabase URL/anon key missing or wrong in `.env.local`. Restart `npm run dev`.

**Admin shows “Supabase not connected”**  
→ Add `SUPABASE_SERVICE_ROLE_KEY` and restart.

**SQL errors on nabus-full-setup.sql**  
→ Use a **fresh** Supabase project. If re-running, some “already exists” notices are OK; real errors usually mean the project was partially set up — create a new project or drop tables first.

**Need to refresh vehicle seed**  
→ `npm run db:seed` then re-run `seed-vehicles.sql`.

---

## Regenerate bundled migration file

After editing files in `supabase/migrations/`:

```powershell
node scripts/bundle-supabase-migrations.mjs
```

This updates `supabase/nabus-full-setup.sql`.
