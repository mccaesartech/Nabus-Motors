/**
 * Restore empty Supabase env vars on Vercel (Production + Preview).
 *
 * 1. Copy .env.supabase-restore.example → .env.supabase-restore
 * 2. Paste keys from Supabase Dashboard → Project Settings → API
 *    For production after Custom Domain: set NEXT_PUBLIC_SUPABASE_URL=https://auth.truegoshen.com
 *    in .env.supabase-restore (only when auth.truegoshen.com is Active in Supabase).
 * 3. node scripts/restore-vercel-supabase-env.mjs
 *
 * Does not print secret values.
 */
import fs from "fs";
import { spawnSync } from "child_process";

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

const file = ".env.supabase-restore";
const env = loadEnv(file);
const url =
  env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  "https://ddrknhvkhmgdtavpuiiq.supabase.co";
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
const service = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

const missing = [];
if (!anon || anon.length < 20) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
if (!service || service.length < 20) missing.push("SUPABASE_SERVICE_ROLE_KEY");

if (missing.length) {
  console.error(
    `Missing or invalid in ${file}: ${missing.join(", ")}.\n` +
      "Get values from https://supabase.com/dashboard/project/ddrknhvkhmgdtavpuiiq/settings/api"
  );
  process.exit(1);
}

function vercelUpdate(name, value, target) {
  const r = spawnSync(
    "npx",
    ["vercel", "env", "update", name, target, "--value", value, "--yes"],
    { stdio: "inherit", shell: true }
  );
  if (r.status !== 0) {
    console.error(`Failed to update ${name} (${target})`);
    process.exit(r.status ?? 1);
  }
}

for (const target of ["production", "preview"]) {
  vercelUpdate("NEXT_PUBLIC_SUPABASE_URL", url, target);
  vercelUpdate("NEXT_PUBLIC_SUPABASE_ANON_KEY", anon, target);
  vercelUpdate("SUPABASE_SERVICE_ROLE_KEY", service, target);
}

console.log(
  "Supabase env restored on Vercel (production + preview). Run: npx vercel --prod --yes"
);
