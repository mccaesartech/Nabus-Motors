import sharp from "sharp";
import { existsSync, renameSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");

const ORIGINAL_LOGO =
  "C:\\Users\\PC1\\.cursor\\projects\\c-Users-PC1-OneDrive-Desktop-True-Goshen\\assets\\c__Users_PC1_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-8e5c7fd4-9e1f-4f15-a3c2-9f425ae8327a.png";

const SOURCE_CANDIDATES = [
  ORIGINAL_LOGO,
  join(publicDir, "logo-purple.png"),
  join(publicDir, "logo-brand.png"),
  join(publicDir, "logo.png"),
];

function findSource() {
  for (const path of SOURCE_CANDIDATES) {
    if (existsSync(path)) return path;
  }
  throw new Error("Logo source image not found");
}

function isBackgroundPixel(r, g, b, fuzz = 28) {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  const isWhite = min >= 255 - fuzz;
  const isNearWhite = min >= 235 && max - min <= 18;
  return isWhite || isNearWhite;
}

/** Remove near-white background; set all visible pixels to white, keep alpha. */
async function processLogoWhite(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const pixels = Buffer.from(data);

  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    if (isBackgroundPixel(r, g, b)) {
      pixels[i + 3] = 0;
      continue;
    }

    pixels[i] = 255;
    pixels[i + 1] = 255;
    pixels[i + 2] = 255;
  }

  return sharp(pixels, { raw: { width, height, channels } }).png({ compressionLevel: 9 });
}

/** Remove near-white pixels and boost purple clarity for light backgrounds. */
async function processLogoBrand(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const pixels = Buffer.from(data);

  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    if (isBackgroundPixel(r, g, b)) {
      pixels[i + 3] = 0;
      continue;
    }

    pixels[i] = Math.min(255, Math.round(r * 1.06 + 4));
    pixels[i + 1] = Math.min(255, Math.round(g * 1.04 + 2));
    pixels[i + 2] = Math.min(255, Math.round(b * 1.08 + 6));
  }

  return sharp(pixels, { raw: { width, height, channels } })
    .modulate({ brightness: 1.05, saturation: 1.12 })
    .linear(1.12, -14)
    .png({ compressionLevel: 9 });
}

/** Crop to non-transparent bounding box with padding. */
async function trimTransparent(pipeline, padding = 0) {
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

  if (minX > maxX || minY > maxY) {
    return pipeline;
  }

  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const cropWidth = Math.min(width, maxX + padding + 1) - left;
  const cropHeight = Math.min(height, maxY + padding + 1) - top;

  if (cropWidth < 1 || cropHeight < 1) {
    return pipeline;
  }

  return pipeline.extract({
    left,
    top,
    width: cropWidth,
    height: cropHeight,
  });
}

async function writePng(pipeline, destPath) {
  const tmp = `${destPath}.tmp`;
  await pipeline.png().toFile(tmp);
  try {
    if (existsSync(destPath)) unlinkSync(destPath);
  } catch {
    /* ignore */
  }
  renameSync(tmp, destPath);
}

async function writeFavicons(iconPipeline) {
  const icon32 = iconPipeline.clone().resize(32, 32, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  const icon180 = iconPipeline.clone().resize(180, 180, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  const icon16 = iconPipeline.clone().resize(16, 16, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  await writePng(icon32, join(publicDir, "favicon-32.png"));
  await writePng(icon180, join(publicDir, "apple-touch-icon.png"));
  await writePng(icon16, join(publicDir, "favicon.ico"));
}

async function writeLogoSet(processedBuffer, meta, { fullName, iconName }) {
  const processed = sharp(processedBuffer);

  const full = await trimTransparent(processed.clone(), 4);
  await writePng(
    full.clone().resize(1024, null, { fit: "inside", withoutEnlargement: false }),
    join(publicDir, fullName)
  );
  console.log(`Wrote ${fullName}`);

  const iconHeight = Math.round(meta.height * 0.44);
  const iconTrimmed = await trimTransparent(
    processed.clone().extract({
      left: 0,
      top: 0,
      width: meta.width,
      height: iconHeight,
    }),
    10
  );
  const iconBuffer = await iconTrimmed.png().toBuffer();

  await writePng(
    sharp(iconBuffer).resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }),
    join(publicDir, iconName)
  );
  console.log(`Wrote ${iconName}`);

  return iconBuffer;
}

async function main() {
  const source = findSource();
  console.log("Source:", source);

  const meta = await sharp(source).metadata();
  console.log("Dimensions:", meta.width, "x", meta.height);

  const whiteBuffer = await (await processLogoWhite(source)).png().toBuffer();
  const whiteIconBuffer = await writeLogoSet(whiteBuffer, meta, {
    fullName: "logo.png",
    iconName: "logo-icon.png",
  });

  const brandBuffer = await (await processLogoBrand(source)).png().toBuffer();
  await writeLogoSet(brandBuffer, meta, {
    fullName: "logo-purple.png",
    iconName: "logo-icon-purple.png",
  });

  await writeFavicons(sharp(whiteIconBuffer));

  console.log(
    "Wrote logo.png, logo-icon.png, logo-purple.png, logo-icon-purple.png, favicon-32.png, apple-touch-icon.png, favicon.ico"
  );

  const { spawnSync } = await import("child_process");
  const gen = spawnSync("node", ["scripts/generate-print-logo-data.mjs"], {
    cwd: root,
    stdio: "inherit",
  });
  if (gen.status !== 0) process.exit(gen.status ?? 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
