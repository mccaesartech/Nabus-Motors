/**
 * Push required production env vars from .env.local to Vercel (nabus-motors).
 * Does not print secret values.
 */
import fs from "fs";
import { spawnSync } from "child_process";

const ENV_FILE = ".env.local";
const TARGETS = ["production", "preview"];

const REQUIRED_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_WHATSAPP_NUMBER",
  "ADMIN_PASSWORD",
  "ADMIN_SECRET",
  "CRON_SECRET",
];

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

function vercelSet(name, value, target) {
  const add = spawnSync(
    "npx",
    ["vercel", "env", "add", name, target, "--force", "--yes"],
    { input: value, encoding: "utf8", shell: true }
  );
  if (add.status === 0) {
    console.log(`Set ${name} (${target})`);
    return;
  }

  const update = spawnSync(
    "npx",
    ["vercel", "env", "update", name, target, "--value", value, "--yes"],
    { stdio: "pipe", shell: true }
  );
  if (update.status !== 0) {
    console.error(`Failed ${name} (${target})`);
    process.exit(update.status ?? 1);
  }
  console.log(`Updated ${name} (${target})`);
}

const env = loadEnv(ENV_FILE);
if (!Object.keys(env).length) {
  console.error(`No variables found in ${ENV_FILE}`);
  process.exit(1);
}

const missing = REQUIRED_KEYS.filter((key) => !env[key]?.trim());
if (missing.length) {
  console.error(`Missing in ${ENV_FILE}: ${missing.join(", ")}`);
  process.exit(1);
}

for (const target of TARGETS) {
  for (const key of REQUIRED_KEYS) {
    vercelSet(key, env[key].trim(), target);
  }
}

console.log("Done. Redeploy: npx vercel deploy --prod --yes --scope mccaesartech");
