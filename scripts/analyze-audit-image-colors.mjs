/**
 * Analyze primary images from scripts/.inventory-color-audit.json
 * and propose canonical color labels. No DB credentials required.
 *
 * Usage: node scripts/analyze-audit-image-colors.mjs
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import photoColors from "../src/lib/data/car-photo-colors.json" with { type: "json" };

const AUDIT_PATH = path.join("scripts", ".inventory-color-audit.json");
const OUT_PATH = path.join("scripts", ".inventory-color-from-photos.json");
const SQL_PATH = path.join("scripts", "correct-inventory-colors-from-photos.sql");

const LABEL_RGB = {
  "Pearl White": [242, 240, 234],
  "Silver Frost": [197, 202, 208],
  "Atomic Grey": [139, 142, 147],
  "Graphite Grey": [92, 95, 100],
  "Midnight Black": [28, 28, 30],
  "Obsidian Black": [11, 11, 12],
  "Deep Blue": [30, 58, 95],
  "Deep Green": [46, 65, 62],
  "Champagne Gold": [197, 165, 114],
  "Radiant Red": [139, 30, 30],
};

function normalizeColorKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

function pexelsPhotoIdFromUrl(url) {
  if (!url) return null;
  const match = String(url).match(/pexels\.com\/photos\/(\d+)\//i);
  if (!match) return null;
  const id = Number.parseInt(match[1], 10);
  return Number.isFinite(id) ? id : null;
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
  const isBlueHue = h >= 185 && h <= 265;
  const isGreenHue = h >= 85 && h <= 170;
  const isRedHue = h < 20 || h > 345;
  const isGoldHue = h >= 28 && h <= 75;
  const blueDominance = b - Math.max(r, g);

  // Require real chroma for blue — grey body panels often have a tiny blue cast.
  if (isBlueHue && s >= 0.16 && blueDominance >= 6) return "Deep Blue";
  if (isBlueHue && s >= 0.12 && blueDominance >= 14) return "Deep Blue";
  if (isGreenHue && s > 0.16 && g > r + 6 && g >= b) return "Deep Green";
  if (isRedHue && s > 0.22 && l < 0.72) return "Radiant Red";
  if (isGoldHue && s > 0.18 && l > 0.28 && l < 0.78) return "Champagne Gold";

  if (l < 0.16) {
    if (s > 0.22 && isBlueHue && blueDominance >= 8) return "Deep Blue";
    if (s > 0.18 && isGreenHue) return "Deep Green";
    if (b > r + 12 && b >= g + 4 && s > 0.12) return "Midnight Black";
    return "Obsidian Black";
  }

  // Neutrals: prefer greyscale ladder when saturation is low
  if (s < 0.16 || blueDominance < 4) {
    if (l > 0.82) return "Pearl White";
    // Metallic silver paint often samples mid-grey; prefer Silver Frost for light bodies
    if (l > 0.45) return "Silver Frost";
    if (l > 0.32) return "Atomic Grey";
    if (l > 0.16) return "Graphite Grey";
    return "Obsidian Black";
  }

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
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

async function sampleCarBodyColor(buffer) {
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 320;
  const height = meta.height ?? 220;
  // Upper-mid body (hood/doors), avoid wheels/road and sky
  const left = Math.floor(width * 0.18);
  const cropW = Math.max(1, Math.floor(width * 0.64));
  const top = Math.floor(height * 0.28);
  const cropH = Math.max(1, Math.floor(height * 0.34));

  const { data, info } = await sharp(buffer)
    .extract({
      left,
      top,
      width: Math.min(cropW, width - left),
      height: Math.min(cropH, height - top),
    })
    .resize(120, 72, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = [];
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const { s, l } = rgbToHsl(r, g, b);
    // Drop shadows, tires, sky, and blown highlights
    if (l < 0.18 || l > 0.9) continue;
    // Prefer body paint over asphalt/vegetation by mid luminance + some chroma weight
    const w = (l > 0.3 && l < 0.8 ? 1.4 : 0.7) * (0.6 + s);
    pixels.push({ r, g, b, l, w });
  }

  if (!pixels.length) {
    const stats = await sharp(buffer)
      .extract({
        left,
        top,
        width: Math.min(cropW, width - left),
        height: Math.min(cropH, height - top),
      })
      .stats();
    return {
      r: stats.channels[0].mean,
      g: stats.channels[1].mean,
      b: stats.channels[2].mean,
    };
  }

  // Weighted mean of mid-band pixels
  let wr = 0;
  let wg = 0;
  let wb = 0;
  let wsum = 0;
  for (const p of pixels) {
    wr += p.r * p.w;
    wg += p.g * p.w;
    wb += p.b * p.w;
    wsum += p.w;
  }
  return { r: wr / wsum, g: wg / wsum, b: wb / wsum };
}

async function downloadImage(url) {
  // Prefer larger Pinterest variants when tiny 236x thumbs are used
  let fetchUrl = url;
  if (/pinimg\.com\/236x\//i.test(url)) {
    fetchUrl = url.replace(/\/236x\//i, "/736x/");
  }

  const res = await fetch(fetchUrl, {
    headers: {
      "User-Agent": "true-goshen-auto-color-corrector/1.0",
      Accept: "image/*,*/*",
      Referer: "https://www.pinterest.com/",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    if (fetchUrl !== url) {
      const res2 = await fetch(url, {
        headers: {
          "User-Agent": "true-goshen-auto-color-corrector/1.0",
          Accept: "image/*,*/*",
          Referer: "https://www.pinterest.com/",
        },
      });
      if (!res2.ok) throw new Error(`HTTP ${res.status}/${res2.status}`);
      return Buffer.from(await res2.arrayBuffer());
    }
    throw new Error(`HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function sqlEscape(value) {
  return String(value).replace(/'/g, "''");
}

async function main() {
  const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, "utf8"));
  const vehicles = audit.vehicles || [];
  console.log(`Analyzing ${vehicles.length} audited vehicles`);

  const results = [];
  const CONCURRENCY = 4;

  for (let i = 0; i < vehicles.length; i += CONCURRENCY) {
    const chunk = vehicles.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      chunk.map(async (v) => {
        const imageUrl = v.primaryImageUrl;
        if (!imageUrl) {
          return {
            slug: v.slug,
            title: v.title,
            detected: null,
            method: "no-image",
            imageUrl: null,
            error: "no primary image",
          };
        }

        const pexelsId = pexelsPhotoIdFromUrl(imageUrl);
        const fromStock = pexelsId != null ? photoColors[String(pexelsId)] : null;
        if (fromStock) {
          return {
            slug: v.slug,
            title: v.title,
            detected: fromStock,
            method: "pexels-map",
            imageUrl,
            pexelsId,
          };
        }

        const buf = await downloadImage(imageUrl);
        const sample = await sampleCarBodyColor(buf);
        const ri = Math.round(sample.r);
        const gi = Math.round(sample.g);
        const bi = Math.round(sample.b);
        return {
          slug: v.slug,
          title: v.title,
          detected: classifyRgb(ri, gi, bi),
          method: "image-analysis",
          imageUrl,
          hex: toHex(ri, gi, bi),
          rgb: [ri, gi, bi],
        };
      })
    );

    for (let j = 0; j < settled.length; j++) {
      const outcome = settled[j];
      if (outcome.status === "fulfilled") results.push(outcome.value);
      else {
        results.push({
          slug: chunk[j].slug,
          title: chunk[j].title,
          detected: null,
          method: "error",
          imageUrl: chunk[j].primaryImageUrl,
          error: outcome.reason?.message || String(outcome.reason),
        });
      }
    }
    process.stdout.write(
      `\rAnalyzed ${Math.min(i + CONCURRENCY, vehicles.length)}/${vehicles.length}`
    );
  }
  console.log("");

  const ok = results.filter((r) => r.detected);
  const failed = results.filter((r) => !r.detected);

  // Deduplicate by slug (keep first)
  const bySlug = new Map();
  for (const r of ok) {
    if (!bySlug.has(r.slug)) bySlug.set(r.slug, r);
  }

  const unique = [...bySlug.values()];
  console.log(`Detected colors for ${unique.length}/${vehicles.length}`);
  console.log(`Failed: ${failed.length}`);

  const labelCounts = {};
  for (const r of unique) {
    labelCounts[r.detected] = (labelCounts[r.detected] || 0) + 1;
  }
  console.log("Distribution:", labelCounts);

  console.log("\nHighlights:");
  for (const r of unique.filter((x) =>
    /seal|dolphin|atto|omoda|patrol|tang|yuan/i.test(x.slug)
  )) {
    console.log(
      `  ${r.slug}: ${r.detected} [${r.method}]${r.hex ? " " + r.hex : ""}`
    );
  }

  const sqlLines = [
    "-- Exterior color corrections from primary listing photo analysis.",
    `-- Generated ${new Date().toISOString()}`,
    "-- Run in Supabase SQL Editor (updates color only, by slug).",
    "",
    "BEGIN;",
    "",
  ];
  for (const r of unique.sort((a, b) => a.slug.localeCompare(b.slug))) {
    sqlLines.push(
      `UPDATE vehicles SET color = '${sqlEscape(r.detected)}' WHERE slug = '${sqlEscape(r.slug)}'; -- ${sqlEscape(r.title || "")} via ${r.method}`
    );
  }
  sqlLines.push("", "COMMIT;", "");
  fs.writeFileSync(SQL_PATH, sqlLines.join("\n"), "utf8");

  const payload = {
    generatedAt: new Date().toISOString(),
    count: unique.length,
    failed: failed.length,
    distribution: labelCounts,
    corrections: unique,
    failures: failed,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`Wrote ${SQL_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
