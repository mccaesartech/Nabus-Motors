import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

const migrationsDir = join(import.meta.dirname, "..", "supabase", "migrations");
const outFile = join(import.meta.dirname, "..", "supabase", "nabus-full-setup.sql");

const skip = new Set(["RUN_PREORDER_FIX.sql", "RUN_019_COMPLETE.sql"]);

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql") && !skip.has(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const chunks = [
  `-- Nabus Motors — full database setup
-- Generated: ${new Date().toISOString()}
-- Paste this ENTIRE file into Supabase Dashboard → SQL Editor → Run once.
-- Project: nabus-motors (fresh Supabase project)
--
-- After this succeeds, run supabase/seed-vehicles.sql in a second query.

`,
];

for (const file of files) {
  chunks.push(`\n-- ─── ${file} ───\n`);
  chunks.push(readFileSync(join(migrationsDir, file), "utf8"));
  chunks.push("\n");
}

writeFileSync(outFile, chunks.join(""), "utf8");
console.log(`Wrote ${outFile} (${files.length} migrations)`);
