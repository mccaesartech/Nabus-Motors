/**
 * Apply / verify vehicles.price_currency + listed_price (migration 081).
 * Uses service role from .env.local / .env.vercel.local — does not print secrets.
 */
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

const files = [".env.vercel.pull", ".env.vercel.local", ".env.vercel", ".env.local"];
const env = {};
const loaded = [];
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  Object.assign(env, loadEnv(file));
  loaded.push(file);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE;
const dbUrl = env.DATABASE_URL || env.SUPABASE_DB_URL || env.POSTGRES_URL;

console.log(
  JSON.stringify(
    {
      loadedFiles: loaded,
      keyNames: Object.keys(env).filter((k) =>
        /SUPABASE|DATABASE|POSTGRES/i.test(k)
      ),
      hasUrl: Boolean(url),
      hasServiceKey: Boolean(key),
      hasDatabaseUrl: Boolean(dbUrl),
    },
    null,
    2
  )
);

if (!url || !key) {
  console.error("Missing Supabase URL or service role key");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const probe = await sb
  .from("vehicles")
  .select("id, price, price_currency, listed_price")
  .limit(1);

if (!probe.error) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        columnsPresent: true,
        sample: probe.data?.[0] ?? null,
      },
      null,
      2
    )
  );
  process.exit(0);
}

console.log(
  JSON.stringify(
    {
      ok: false,
      columnsPresent: false,
      error: probe.error.message,
      hasDatabaseUrl: Boolean(dbUrl),
      hint: "Run supabase/migrations/081_vehicle_price_currency.sql in Supabase SQL Editor",
    },
    null,
    2
  )
);

if (dbUrl) {
  try {
    const pg = await import("pg");
    const client = new pg.default.Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query(`
      ALTER TABLE vehicles
        ADD COLUMN IF NOT EXISTS price_currency TEXT NOT NULL DEFAULT 'USD';
      ALTER TABLE vehicles
        ADD COLUMN IF NOT EXISTS listed_price INTEGER;
      UPDATE vehicles
      SET listed_price = price
      WHERE listed_price IS NULL
        AND price_currency = 'USD';
      NOTIFY pgrst, 'reload schema';
    `);
    await client.end();
    console.log(JSON.stringify({ appliedViaDatabaseUrl: true }, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(
      "Could not apply via DATABASE_URL:",
      err instanceof Error ? err.message : err
    );
  }
}

process.exit(2);
