import fs from "fs";
import path from "path";
import sharp from "sharp";
import pool from "../src/lib/data/car-photo-pool.json" with { type: "json" };

const SEED_IDS = [
  3593929, 1545743, 3764984, 112460, 164634, 6870896, 919073, 3720372, 1592384,
  1166754, 1144720, 112452, 210019, 244206, 170811, 712618, 4997317, 12681049,
  23220477, 30479248, 25851807, 32536591, 33336584, 14965004, 32462525, 37049415,
  35736787, 35736766, 9799996, 35736777, 13804269, 9105627, 14438397, 2264333,
  20584482, 31661243, 15768199, 30360699, 14776590, 16363816, 9800029, 32078946,
];

const LABEL_RGB = {
  "Pearl White": [245, 245, 242],
  "Silver Frost": [192, 198, 204],
  "Graphite Grey": [82, 86, 90],
  "Atomic Grey": [126, 130, 134],
  "Midnight Black": [16, 20, 30],
  "Obsidian Black": [10, 10, 12],
  "Deep Blue": [28, 52, 98],
  "Champagne Gold": [212, 198, 162],
  "Radiant Red": [186, 32, 42],
  "Deep Green": [24, 62, 48],
};

function collectIds() {
  const ids = new Set(SEED_IDS.map(Number));
  for (const value of Object.values(pool)) {
    if (Array.isArray(value)) {
      for (const id of value) ids.add(Number(id));
    }
  }
  return [...ids].sort((a, b) => a - b);
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }
  return { h: h * 360, s, l };
}

function classifyRgb(r, g, b) {
  const { h, s, l } = rgbToHsl(r, g, b);

  if (l < 0.14) {
    if (s > 0.22 && h >= 190 && h <= 260 && b > r + 8) return "Deep Blue";
    if (s > 0.18 && h >= 90 && h <= 170 && g > r + 6) return "Deep Green";
    if (b > r + 12 && b > g) return "Midnight Black";
    return "Obsidian Black";
  }

  if (s < 0.16) {
    if (l > 0.82) return "Pearl White";
    if (l > 0.58) return "Silver Frost";
    if (l > 0.38) return "Atomic Grey";
    return "Graphite Grey";
  }

  if ((h < 25 || h > 340) && s > 0.25) return "Radiant Red";
  if (h >= 35 && h <= 75 && s > 0.18) return "Champagne Gold";
  if (h >= 190 && h <= 260) return "Deep Blue";
  if (h >= 90 && h <= 170) return "Deep Green";

  let best = "Atomic Grey";
  let bestD = Infinity;
  for (const [label, rgb] of Object.entries(LABEL_RGB)) {
    const d = Math.hypot(r - rgb[0], g - rgb[1], b - rgb[2]);
    if (d < bestD) {
      bestD = d;
      best = label;
    }
  }
  return best;
}

function toHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

async function sampleCenterBand(buffer) {
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 200;
  const height = meta.height ?? 140;
  const top = Math.floor(height * 0.35);
  const bandHeight = Math.max(1, Math.floor(height * 0.3));
  const stats = await sharp(buffer)
    .extract({ left: 0, top, width, height: Math.min(bandHeight, height - top) })
    .stats();
  const r = stats.channels[0].mean;
  const g = stats.channels[1].mean;
  const b = stats.channels[2].mean;
  return { r, g, b };
}

function photoUrl(id) {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=200&h=140&fit=crop`;
}

async function sampleId(id) {
  const res = await fetch(photoUrl(id), {
    headers: { "User-Agent": "true-goshen-auto-color-sampler/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const { r, g, b } = await sampleCenterBand(buf);
  const ri = Math.round(r);
  const gi = Math.round(g);
  const bi = Math.round(b);
  const label = classifyRgb(ri, gi, bi);
  return { id, r: ri, g: gi, b: bi, hex: toHex(ri, gi, bi), label };
}

const CONCURRENCY = 6;

async function main() {
  const ids = collectIds();
  const results = [];
  const failed = [];

  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const chunk = ids.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map((id) => sampleId(id)));
    for (let j = 0; j < settled.length; j++) {
      const id = chunk[j];
      const outcome = settled[j];
      if (outcome.status === "fulfilled") results.push(outcome.value);
      else failed.push({ id, error: outcome.reason?.message ?? String(outcome.reason) });
    }
  }

  results.sort((a, b) => a.id - b.id);
  const outPath = path.join("scripts", ".photo-color-samples.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + "\n", "utf8");

  console.log(`Sampled ${results.length}/${ids.length} photos -> ${outPath}`);
  if (failed.length) {
    console.log("Failed IDs:", failed.map((f) => `${f.id} (${f.error})`).join(", "));
  }
  console.log("id -> label:");
  for (const row of results) {
    console.log(`${row.id} -> ${row.label} (${row.hex})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
