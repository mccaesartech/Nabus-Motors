import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const allowedLegacyDuplicates = new Map([
  ["016", new Set(["016_platform_team_messages.sql", "016_site_content_videos_storage.sql"])],
  ["018", new Set(["018_platform_team_realtime_notifications.sql", "018_preorder_account_linking_fix.sql"])],
  ["033", new Set(["033_cms_auto_tracking_complete.sql", "033_ensure_spare_parts_cms.sql"])],
  ["049", new Set(["049_cart_customer_messaging.sql", "049_performance_indexes.sql"])],
]);

const files = (await readdir(migrationsDir))
  .filter((file) => file.endsWith(".sql"))
  .sort();
const failures = [];
const numbered = new Map();

for (const file of files) {
  const sql = await readFile(join(migrationsDir, file), "utf8");
  if (!sql.trim()) failures.push(`${file}: empty migration`);
  if (/^(<{7}|={7}|>{7})/m.test(sql)) {
    failures.push(`${file}: unresolved merge-conflict marker`);
  }

  const match = /^(\d{3})_[a-z0-9_]+\.sql$/.exec(file);
  if (!match) continue;
  const group = numbered.get(match[1]) ?? [];
  group.push(file);
  numbered.set(match[1], group);
}

for (const [prefix, group] of numbered) {
  if (group.length < 2) continue;
  const allowed = allowedLegacyDuplicates.get(prefix);
  if (
    !allowed ||
    group.length !== allowed.size ||
    group.some((file) => !allowed.has(file))
  ) {
    failures.push(`${prefix}: duplicate migration prefix (${group.join(", ")})`);
  }
}

if (failures.length) {
  console.error("Migration validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${files.length} SQL migrations.`);
}
