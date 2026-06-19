import fs from "fs";
import path from "path";
import pool from "../src/lib/data/car-photo-pool.json" with { type: "json" };

const outDir = path.join("public", "vehicles", "cars");
fs.mkdirSync(outDir, { recursive: true });

const force = process.argv.includes("--force");
const slugsPath = path.join("scripts", "vehicle-slugs.json");

if (!fs.existsSync(slugsPath)) {
  console.error("Run: npx tsx scripts/export-slugs.ts first");
  process.exit(1);
}

const slugs = JSON.parse(fs.readFileSync(slugsPath, "utf8"));

function hashSlug(slug) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

function photoMeta(index, slug) {
  const h = hashSlug(slug);
  const ids = pool.default;
  const id = ids[(index + h) % ids.length];
  const w = 960 + (h % 280);
  const hPx = 640 + ((h >> 4) % 240);
  return { id, w, hPx };
}

async function fetchPhoto(id, w, hPx) {
  const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${hPx}&fit=crop`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

async function downloadSlug(slug, index) {
  const dest = path.join(outDir, `${slug}.jpg`);
  if (fs.existsSync(dest) && !force) {
    return;
  }

  const { id, w, hPx } = photoMeta(index, slug);
  let buf = await fetchPhoto(id, w, hPx);

  if (!buf) {
    for (const fallbackId of pool.default) {
      buf = await fetchPhoto(fallbackId, w, hPx);
      if (buf) break;
    }
  }

  if (!buf) {
    console.error("FAIL", slug);
    return;
  }

  fs.writeFileSync(dest, buf);
  if (index % 50 === 0) console.log("Progress", index, "/", slugs.length);
}

const CONCURRENCY = 8;
for (let i = 0; i < slugs.length; i += CONCURRENCY) {
  await Promise.all(
    slugs.slice(i, i + CONCURRENCY).map((slug, j) => downloadSlug(slug, i + j))
  );
}

console.log("Done", slugs.length, "unique vehicle images");
