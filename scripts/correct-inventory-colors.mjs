/**
 * Correct vehicles.color from primary listing photos.
 *
 * Loads credentials from .env.local.colorfix (or .env.local / process.env).
 * Prefers known Pexels photo→color map; otherwise samples the image with sharp
 * and maps to the nearest canonical label in vehicle-colors.ts.
 *
 * Usage:
 *   node scripts/correct-inventory-colors.mjs            # dry-run
 *   node scripts/correct-inventory-colors.mjs --apply    # write DB updates
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import photoColors from "../src/lib/data/car-photo-colors.json" with { type: "json" };

const APPLY = process.argv.includes("--apply");
const ENV_CANDIDATES = [
  ".env.local.colorfix",
  ".env.local",
  ".env.vercel",
  ".env",
];
const REPORT_PATH = path.join("scripts", ".inventory-color-corrections.json");
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

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const text = fs.readFileSync(filePath, "utf8");
  let loaded = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
      loaded += 1;
    }
  }
  console.log(`Loaded ${loaded} env keys from ${filePath} (values not printed)`);
  return loaded > 0;
}

function bootstrapEnv() {
  for (const candidate of ENV_CANDIDATES) {
    if (loadEnvFile(candidate)) return candidate;
  }
  return null;
}

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

function colorLabelForPhotoId(photoId) {
  if (photoId == null) return null;
  const label = photoColors[String(photoId)];
  return label?.trim() || null;
}

function primaryImageUrl(row) {
  const explicit = (row.primary_image_url || "").trim();
  if (explicit) return explicit;
  if (Array.isArray(row.images) && row.images.length) {
    const first = String(row.images[0] || "").trim();
    if (first) return first;
  }
  if (Array.isArray(row.additional_images) && row.additional_images.length) {
    const first = String(row.additional_images[0] || "").trim();
    if (first) return first;
  }
  return null;
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

  if (s < 0.16 || blueDominance < 4) {
    if (l > 0.82) return "Pearl White";
    if (l > 0.58) return "Silver Frost";
    if (l > 0.38) return "Atomic Grey";
    if (l > 0.18) return "Graphite Grey";
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

/**
 * Sample body-biased pixels: center band + mid brightness filter to reduce
 * sky/road/asphalt contamination common in listing photos.
 */
async function sampleCarBodyColor(buffer) {
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 320;
  const height = meta.height ?? 220;

  // Prefer a lower-center crop (car body) over full-frame mean
  const left = Math.floor(width * 0.15);
  const cropW = Math.max(1, Math.floor(width * 0.7));
  const top = Math.floor(height * 0.32);
  const cropH = Math.max(1, Math.floor(height * 0.42));

  const { data, info } = await sharp(buffer)
    .extract({
      left,
      top,
      width: Math.min(cropW, width - left),
      height: Math.min(cropH, height - top),
    })
    .resize(96, 64, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = [];
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const { s, l } = rgbToHsl(r, g, b);
    // Drop very bright sky/specular and very dark tire/shadow clumps
    if (l > 0.92 || l < 0.06) continue;
    // Drop highly green foliage-ish if rare; keep car greens via later classify
    pixels.push({ r, g, b, s, l, w: 0.5 + s }); // weight saturated pixels more
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
      sampleCount: 0,
    };
  }

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
  return {
    r: wr / wsum,
    g: wg / wsum,
    b: wb / wsum,
    sampleCount: pixels.length,
  };
}

async function downloadImage(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "true-goshen-auto-color-corrector/1.0",
      Accept: "image/*,*/*",
      Referer: "https://truegoshen.vercel.app/",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function analyzeImage(url) {
  const buf = await downloadImage(url);
  const { r, g, b, sampleCount } = await sampleCarBodyColor(buf);
  const ri = Math.round(r);
  const gi = Math.round(g);
  const bi = Math.round(b);
  const label = classifyRgb(ri, gi, bi);
  return {
    label,
    hex: toHex(ri, gi, bi),
    rgb: [ri, gi, bi],
    sampleCount,
  };
}

function sqlEscape(value) {
  return String(value).replace(/'/g, "''");
}

function writeSql(updates) {
  const lines = [
    "-- Auto-generated exterior color corrections from primary listing photos.",
    "-- Review then run in Supabase SQL editor if the Node apply path is unavailable.",
    "",
    "BEGIN;",
    "",
  ];
  for (const u of updates) {
    lines.push(
      `UPDATE vehicles SET color = '${sqlEscape(u.detected)}' WHERE id = '${sqlEscape(u.id)}' AND slug = '${sqlEscape(u.slug)}'; -- was: ${sqlEscape(u.current || "")} via ${u.method}`
    );
  }
  lines.push("", "COMMIT;", "");
  fs.writeFileSync(SQL_PATH, lines.join("\n"), "utf8");
}

async function fetchPublicVehicles(supabase) {
  const select =
    "id, slug, make, model, year, color, status, approval_status, images, primary_image_url, additional_images";
  const pageSize = 100;
  let from = 0;
  const all = [];
  for (;;) {
    const { data, error } = await supabase
      .from("vehicles")
      .select(select)
      .in("status", ["available", "pre_order"])
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data || [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  // Keep publicly listed rows (approved, or pending with published snapshot is handled in app —
  // for color fix we update all available/pre_order rows that have images).
  return all.filter((row) => {
    const approval = row.approval_status;
    return (
      !approval ||
      approval === "approved" ||
      approval === "pending_approval" ||
      approval === "rejected"
    );
  });
}

async function main() {
  const envSource = bootstrapEnv();
  if (!envSource) {
    console.error(
      "No env file found. Run: npx vercel env pull .env.local.colorfix --environment=production --yes"
    );
    process.exit(1);
  }

  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ""
  ).trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  console.log(`Supabase host: ${new URL(url).hostname}`);
  console.log(`Mode: ${APPLY ? "APPLY (writes enabled)" : "DRY-RUN (no writes)"}`);

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const vehicles = await fetchPublicVehicles(supabase);
  console.log(`Fetched ${vehicles.length} available/pre_order vehicles`);

  const results = [];
  const CONCURRENCY = 4;

  for (let i = 0; i < vehicles.length; i += CONCURRENCY) {
    const chunk = vehicles.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      chunk.map(async (row) => {
        const imageUrl = primaryImageUrl(row);
        const current = (row.color || "").trim() || null;
        if (!imageUrl) {
          return {
            id: row.id,
            slug: row.slug,
            title: `${row.year} ${row.make} ${row.model}`,
            current,
            detected: null,
            method: "no-image",
            imageUrl: null,
            changed: false,
            error: "no primary image",
          };
        }

        const pexelsId = pexelsPhotoIdFromUrl(imageUrl);
        const fromStock = colorLabelForPhotoId(pexelsId);
        if (fromStock) {
          return {
            id: row.id,
            slug: row.slug,
            title: `${row.year} ${row.make} ${row.model}`,
            current,
            detected: fromStock,
            method: "pexels-map",
            imageUrl,
            pexelsId,
            hex: null,
            changed:
              !current ||
              normalizeColorKey(current) !== normalizeColorKey(fromStock),
          };
        }

        const analysis = await analyzeImage(imageUrl);
        return {
          id: row.id,
          slug: row.slug,
          title: `${row.year} ${row.make} ${row.model}`,
          current,
          detected: analysis.label,
          method: "image-analysis",
          imageUrl,
          hex: analysis.hex,
          rgb: analysis.rgb,
          sampleCount: analysis.sampleCount,
          changed:
            !current ||
            normalizeColorKey(current) !== normalizeColorKey(analysis.label),
        };
      })
    );

    for (let j = 0; j < settled.length; j++) {
      const outcome = settled[j];
      if (outcome.status === "fulfilled") results.push(outcome.value);
      else {
        const row = chunk[j];
        results.push({
          id: row.id,
          slug: row.slug,
          title: `${row.year} ${row.make} ${row.model}`,
          current: (row.color || "").trim() || null,
          detected: null,
          method: "error",
          imageUrl: primaryImageUrl(row),
          changed: false,
          error: outcome.reason?.message || String(outcome.reason),
        });
      }
    }
    process.stdout.write(
      `\rAnalyzed ${Math.min(i + CONCURRENCY, vehicles.length)}/${vehicles.length}`
    );
  }
  console.log("");

  const toUpdate = results.filter((r) => r.changed && r.detected);
  const unchanged = results.filter((r) => !r.changed && r.detected);
  const failed = results.filter((r) => !r.detected);

  console.log(`\nWould update: ${toUpdate.length}`);
  console.log(`Already correct: ${unchanged.length}`);
  console.log(`Failed/skipped: ${failed.length}`);

  // Highlight known complaint examples
  const highlight = results.filter((r) =>
    /seal|dolphin|atto|omoda|patrol/i.test(r.slug)
  );
  console.log("\nExamples:");
  for (const r of highlight.slice(0, 12)) {
    console.log(
      `  ${r.slug}: ${r.current || "(empty)"} -> ${r.detected || "FAILED"} [${r.method}]${r.hex ? " " + r.hex : ""}`
    );
  }

  writeSql(toUpdate);
  console.log(`Wrote SQL fallback -> ${SQL_PATH}`);

  let applied = 0;
  let applyErrors = [];
  if (APPLY && toUpdate.length) {
    for (const u of toUpdate) {
      const { error } = await supabase
        .from("vehicles")
        .update({ color: u.detected })
        .eq("id", u.id);
      if (error) {
        applyErrors.push({ slug: u.slug, error: error.message });
      } else {
        applied += 1;
      }
    }
    console.log(`Applied ${applied}/${toUpdate.length} updates`);
    if (applyErrors.length) {
      console.log("Apply errors:", applyErrors);
    }
  } else if (!APPLY) {
    console.log("Dry-run only. Re-run with --apply to write colors.");
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: APPLY ? "apply" : "dry-run",
    counts: {
      total: results.length,
      toUpdate: toUpdate.length,
      unchanged: unchanged.length,
      failed: failed.length,
      applied,
    },
    applyErrors,
    results,
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`Wrote report -> ${REPORT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
