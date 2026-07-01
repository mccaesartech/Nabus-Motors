# ⚠️ Run THESE files in Supabase SQL Editor

**Do NOT paste anything from `scripts/` or `src/` — those are TypeScript, not SQL.**

| Step | File to open in Cursor | First line should look like |
|------|------------------------|----------------------------|
| **1** | `supabase/setup.sql` | `-- True Goshen Auto — full database setup` |
| **2** | `supabase/seed-vehicles.sql` | `-- Auto-generated: 75 vehicles` |

## How to run

1. In Cursor, open **`supabase/setup.sql`**
2. Select all (`Ctrl+A`) → Copy (`Ctrl+C`)
3. Supabase Dashboard → **SQL Editor** → **New query**
4. Paste → click **Run**
5. Wait for success, then repeat steps 1–4 with **`supabase/seed-vehicles.sql`**

## Wrong files (will error)

- ❌ `scripts/generate-supabase-seed.ts` — starts with `import { writeFileSync }`
- ❌ `src/lib/admin/auth.ts` — starts with `import { cookies }`
- ❌ `supabase/seed.sql` — old 12-car sample (optional, skip it)

## After success

Table Editor → **vehicles** should show **75 rows**.
