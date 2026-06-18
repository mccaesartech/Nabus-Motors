import fs from "fs";
import path from "path";

const outDir = path.join("public", "vehicles", "cars");
fs.mkdirSync(outDir, { recursive: true });

const force = process.argv.includes("--force");
const slugsPath = path.join("scripts", "vehicle-slugs.json");

if (!fs.existsSync(slugsPath)) {
  console.error("Run: npx tsx scripts/export-slugs.ts first");
  process.exit(1);
}

const slugs = JSON.parse(fs.readFileSync(slugsPath, "utf8"));

/**
 * Verified exterior-only car/truck photos (no people, no hands).
 * Removed IDs that showed hands, steering POV, or toy-road scenes.
 */
const CAR_ONLY_IDS = [
  170811, 210019, 3802510, 799443, 919073, 116675, 279949, 3802508,
  112460, 110844, 164634, 1149137, 3764984, 1638119, 2430032,
  1149831, 2361492, 1934851, 1007770, 120049, 6870896,
];

function hashSlug(slug) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

function photoMeta(index, slug) {
  const h = hashSlug(slug);
  // Cycle through pool by index so neighbors look different; crop varies per slug
  const id = CAR_ONLY_IDS[(index + h) % CAR_ONLY_IDS.length];
  const w = 960 + (h % 320);
  const hPx = 640 + ((h >> 4) % 280);
  const fpX = 0.15 + (h % 70) / 100;
  return { id, w, hPx, fpX };
}

async function fetchPhoto(id, w, hPx, fpX) {
  const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${hPx}&fit=crop&crop=focalpoint&fp-x=${fpX.toFixed(2)}&fp-y=0.5`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

async function downloadSlug(slug, index) {
  const dest = path.join(outDir, `${slug}.jpg`);
  if (fs.existsSync(dest) && !force) {
    return;
  }

  const { id, w, hPx, fpX } = photoMeta(index, slug);
  let buf = await fetchPhoto(id, w, hPx, fpX);

  if (!buf) {
    for (const fallbackId of CAR_ONLY_IDS) {
      buf = await fetchPhoto(fallbackId, w, hPx, fpX);
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
