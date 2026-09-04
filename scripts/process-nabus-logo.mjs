/**
 * Process Nabus Motors logo — dark monogram with cream outline on warm gradient.
 * Generates icon + full assets, white (dark surfaces) and brand (light surfaces) variants.
 */
import sharp from "sharp";
import { existsSync, renameSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");

const SOURCE_CANDIDATES = [
  join(publicDir, "logo-brand-source.png"),
  join(
    root,
    "..",
    "..",
    "..",
    ".cursor",
    "projects",
    "c-Users-PC1-OneDrive-Desktop-Nabus",
    "assets",
    "c__Users_PC1_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_Screenshot_2026-09-04_092942-853d0dd8-baec-40bd-afde-ad1eaf698c5d.png"
  ),
];

function findSource() {
  for (const path of SOURCE_CANDIDATES) {
    if (existsSync(path)) return path;
  }
  throw new Error("Nabus logo source not found — place logo-brand-source.png in public/");
}

/** Warm gradient / photo background behind the monogram. */
function isBackgroundPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const spread = max - min;

  // Light warm tan / cream backdrop
  if (min >= 160 && r >= g && spread <= 80) return true;
  // Terracotta / orange gradient
  if (r >= 140 && g >= 60 && b <= 120 && r > g && spread >= 20) return true;
  // Olive / green tint in lower-right
  if (g >= 90 && r >= 70 && b <= 100 && g >= r * 0.85) return true;

  return false;
}

async function loadPixels(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { pixels: Buffer.from(data), info };
}

function processVariant(pixels, channels, mode) {
  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    if (isBackgroundPixel(r, g, b)) {
      pixels[i + 3] = 0;
      continue;
    }

    const lum = (r * 0.299 + g * 0.587 + b * 0.114) | 0;

    if (mode === "white") {
      pixels[i] = 255;
      pixels[i + 1] = 255;
      pixels[i + 2] = 255;
      pixels[i + 3] = 255;
      continue;
    }

    if (mode === "brand") {
      // Dark fill → Nabus brown; light outline → warm cream
      if (lum < 95) {
        pixels[i] = 42;
        pixels[i + 1] = 31;
        pixels[i + 2] = 24;
      } else {
        pixels[i] = 237;
        pixels[i + 1] = 224;
        pixels[i + 2] = 200;
      }
      pixels[i + 3] = 255;
    }
  }
}

async function trimTransparent(pipeline, padding = 8) {
  const { data, info } = await pipeline
    .clone()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * channels + 3];
      if (alpha > 12) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (minX > maxX || minY > maxY) return pipeline;

  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const cropWidth = Math.min(width, maxX + padding + 1) - left;
  const cropHeight = Math.min(height, maxY + padding + 1) - top;

  return pipeline.extract({ left, top, width: cropWidth, height: cropHeight });
}

async function writePng(pipeline, destPath) {
  const tmp = `${destPath}.tmp`;
  await pipeline.png({ compressionLevel: 9 }).toFile(tmp);
  try {
    if (existsSync(destPath)) unlinkSync(destPath);
  } catch {
    /* ignore */
  }
  renameSync(tmp, destPath);
}

async function writeFavicons(iconPipeline) {
  await writePng(
    iconPipeline.clone().resize(32, 32, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }),
    join(publicDir, "favicon-32.png")
  );
  await writePng(
    iconPipeline.clone().resize(180, 180, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }),
    join(publicDir, "apple-touch-icon.png")
  );
  await writePng(
    iconPipeline.clone().resize(16, 16, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }),
    join(publicDir, "favicon.ico")
  );
}

async function main() {
  const source = findSource();
  console.log("Source:", source);

  const { pixels: brandPixels, info } = await loadPixels(source);
  const { pixels: whitePixels } = await loadPixels(source);

  processVariant(brandPixels, info.channels, "brand");
  processVariant(whitePixels, info.channels, "white");

  const brandTrimmed = await trimTransparent(
    sharp(brandPixels, { raw: { width: info.width, height: info.height, channels: info.channels } })
  );
  const whiteTrimmed = await trimTransparent(
    sharp(whitePixels, { raw: { width: info.width, height: info.height, channels: info.channels } })
  );

  const iconSize = 512;
  const fullWidth = 1024;
  const fullHeight = 374;

  const brandIcon = brandTrimmed.clone().resize(iconSize, iconSize, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  const whiteIcon = whiteTrimmed.clone().resize(iconSize, iconSize, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  await writePng(brandIcon, join(publicDir, "logo-icon-purple.png"));
  await writePng(whiteIcon, join(publicDir, "logo-icon.png"));
  console.log("Wrote logo-icon-purple.png, logo-icon.png");

  const brandFull = brandTrimmed.clone().resize(fullWidth, fullHeight, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  const whiteFull = whiteTrimmed.clone().resize(fullWidth, fullHeight, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  await writePng(brandFull, join(publicDir, "logo-purple.png"));
  await writePng(whiteFull, join(publicDir, "logo.png"));
  console.log("Wrote logo-purple.png, logo.png");

  await writeFavicons(brandIcon);
  console.log("Wrote favicons");

  const { spawnSync } = await import("child_process");
  const gen = spawnSync("node", ["scripts/generate-print-logo-data.mjs"], {
    cwd: root,
    stdio: "inherit",
  });
  if (gen.status !== 0) process.exit(gen.status ?? 1);

  const pwa = spawnSync("node", ["scripts/generate-pwa-icons.mjs"], {
    cwd: root,
    stdio: "inherit",
  });
  if (pwa.status !== 0) process.exit(pwa.status ?? 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
