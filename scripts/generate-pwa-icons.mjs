import sharp from "sharp";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");
const iconsDir = join(publicDir, "icons");

const BRAND = {
  purple: "#4c1d95",
  purpleDark: "#2e1065",
  lavender: "#faf5ff",
  accent: "#8b5cf6",
  white: "#ffffff",
};

/** Standard icons fill ~92% of canvas; maskable keeps logo in 72% safe zone. */
const FILL_RATIO = {
  customer: { standard: 0.92, maskable: 0.72 },
  admin: { standard: 1, maskable: 0.8 },
};

const CUSTOMER_SOURCE_CANDIDATES = [
  join(iconsDir, "source-logo.png"),
  join(publicDir, "logo-icon-purple.png"),
  join(publicDir, "logo-icon.png"),
  join(publicDir, "logo-purple.png"),
  join(publicDir, "logo.png"),
];

const ADMIN_SOURCE_CANDIDATES = [
  join(iconsDir, "admin", "source-logo.png"),
  join(iconsDir, "admin-source-logo.png"),
];

function findCustomerSource() {
  for (const path of CUSTOMER_SOURCE_CANDIDATES) {
    if (existsSync(path)) return path;
  }
  return null;
}

function findAdminSource() {
  for (const path of ADMIN_SOURCE_CANDIDATES) {
    if (existsSync(path)) return path;
  }
  return null;
}

function isDarkBackgroundPixel(r, g, b, fuzz = 36) {
  return r <= fuzz && g <= fuzz && b <= fuzz;
}

function isNearWhitePixel(r, g, b, fuzz = 12) {
  return r >= 255 - fuzz && g >= 255 - fuzz && b >= 255 - fuzz;
}

function isBrandContentPixel(r, g, b, { admin = false, purpleOnly = false } = {}) {
  if (isNearWhitePixel(r, g, b)) return false;

  if (purpleOnly) {
    return isPurplePixel(r, g, b);
  }

  if (admin) {
    if (isPurplePixel(r, g, b)) return true;
    if (r > 180 && g > 180 && b > 180) return true;
    return false;
  }

  if (b > 80 && r < 200 && b > g + 30) return true;
  if (r < 60 && g < 60 && b < 60) return true;
  return false;
}

/** Crop to the bounding box of visible (non-transparent) pixels. */
async function trimTransparent(pipeline) {
  try {
    const trimmed = pipeline.clone().trim({ threshold: 1 });
    const meta = await trimmed.metadata();
    if (!meta.width || !meta.height) return pipeline;
    return trimmed;
  } catch {
    return pipeline;
  }
}

/** Crop away inner whitespace by finding rows/columns with enough brand pixels. */
async function trimToBrandContent(pipeline, options = {}) {
  const { admin = false, purpleOnly = false, densityThreshold = 30, padding = 8 } = options;

  const { data, info } = await pipeline
    .clone()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const rowCounts = new Array(height).fill(0);
  const colCounts = new Array(width).fill(0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const alpha = data[i + 3];
      if (alpha <= 12) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isBrandContentPixel(r, g, b, { admin, purpleOnly })) {
        rowCounts[y]++;
        colCounts[x]++;
      }
    }
  }

  let minY = height;
  let maxY = -1;
  let minX = width;
  let maxX = -1;

  for (let y = 0; y < height; y++) {
    if (rowCounts[y] >= densityThreshold) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  for (let x = 0; x < width; x++) {
    if (colCounts[x] >= densityThreshold) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }

  if (minX > maxX || minY > maxY) {
    return trimTransparent(pipeline);
  }

  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(width - 1, maxX + padding);
  const bottom = Math.min(height - 1, maxY + padding);
  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;

  if (cropWidth < 1 || cropHeight < 1 || left + cropWidth > width || top + cropHeight > height) {
    return trimTransparent(pipeline);
  }

  return pipeline.extract({ left, top, width: cropWidth, height: cropHeight });
}

/** Strip outer black frame, trim borders, and crop tight to logo content. */
async function prepareLogoSource(sourcePath, { admin = false } = {}) {
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const pixels = Buffer.from(data);

  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    if (isDarkBackgroundPixel(r, g, b)) {
      pixels[i + 3] = 0;
    }
  }

  let pipeline = sharp(pixels, { raw: { width, height, channels } });
  pipeline = await trimTransparent(pipeline);
  pipeline = await trimToBrandContent(pipeline, {
    admin,
    densityThreshold: admin ? 20 : 30,
    padding: admin ? 4 : 10,
  });

  const cropped = await pipeline.png().toBuffer();
  return sharp(cropped);
}

function isPurplePixel(r, g, b) {
  return b > 80 && r < 220 && b > g + 15;
}

/** Admin artwork: crop to the purple icon area, removing outer white JPEG letterboxing. */
async function prepareAdminLogoSource(sourcePath) {
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const pixels = Buffer.from(data);

  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    if (isDarkBackgroundPixel(r, g, b)) {
      pixels[i + 3] = 0;
    }
  }

  let pipeline = sharp(pixels, { raw: { width, height, channels } });
  pipeline = await trimTransparent(pipeline);
  pipeline = await trimToBrandContent(pipeline, {
    purpleOnly: true,
    densityThreshold: 200,
    padding: 0,
  });

  const cropped = await pipeline.png().toBuffer();
  return sharp(cropped);
}

function parseHexColor(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
    alpha: 1,
  };
}

async function createBrandedIcon(options) {
  const { size, maskable, admin, logo } = options;
  const ratios = admin ? FILL_RATIO.admin : FILL_RATIO.customer;
  const fillRatio = maskable ? ratios.maskable : ratios.standard;
  const logoSize = Math.round(size * fillRatio);
  const bgHex = admin ? BRAND.purpleDark : BRAND.white;
  const background = parseHexColor(bgHex);

  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  });

  const composites = [];

  if (logo) {
    const logoBuffer = await logo
      .clone()
      .resize(logoSize, logoSize, {
        fit: admin ? "cover" : "contain",
        background: admin ? parseHexColor(bgHex) : { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    composites.push({ input: logoBuffer, gravity: "centre" });
  } else {
    const label = admin ? "A" : "TG";
    const fontSize = Math.round(size * (admin ? 0.34 : 0.28));
    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${bgHex}" />
        <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
          font-family="Arial, Helvetica, sans-serif" font-weight="700"
          font-size="${fontSize}" fill="${admin ? BRAND.white : BRAND.purple}">
          ${label}
        </text>
      </svg>`;
    return sharp(Buffer.from(svg)).png();
  }

  return canvas.composite(composites).png();
}

async function writeCustomerIconSet(dir, logo) {
  mkdirSync(dir, { recursive: true });
  const sizes = [
    { name: "icon-192x192.png", size: 192, maskable: false },
    { name: "icon-192x192-maskable.png", size: 192, maskable: true },
    { name: "icon-512x512.png", size: 512, maskable: false },
    { name: "icon-512x512-maskable.png", size: 512, maskable: true },
  ];

  for (const { name, size, maskable } of sizes) {
    const pipeline = await createBrandedIcon({ size, maskable, admin: false, logo });
    await pipeline.toFile(join(dir, name));
    console.log(`Wrote ${join(dir, name)}`);
  }
}

async function writeAdminIconSet(dir, logo) {
  mkdirSync(dir, { recursive: true });
  const sizes = [
    { name: "icon-192x192.png", size: 192, maskable: false },
    { name: "icon-192x192-maskable.png", size: 192, maskable: true },
    { name: "icon-512x512.png", size: 512, maskable: false },
    { name: "icon-512x512-maskable.png", size: 512, maskable: true },
    { name: "apple-touch-icon.png", size: 180, maskable: false },
  ];

  for (const { name, size, maskable } of sizes) {
    const pipeline = await createBrandedIcon({ size, maskable, admin: true, logo });
    await pipeline.toFile(join(dir, name));
    console.log(`Wrote ${join(dir, name)}`);
  }
}

async function writeFavicons(logo) {
  const sizes = [
    { name: "favicon-16.png", size: 16 },
    { name: "favicon-32.png", size: 32 },
    { name: "apple-touch-icon.png", size: 180 },
  ];

  const buffers = [];

  for (const { name, size } of sizes) {
    const pipeline = await createBrandedIcon({ size, maskable: false, admin: false, logo });
    const buffer = await pipeline.toBuffer();
    const dest = join(publicDir, name);
    writeFileSync(dest, buffer);
    console.log(`Wrote ${dest}`);
    if (size <= 32) {
      buffers.push({ size, buffer });
    }
  }

  if (buffers.length === 2) {
    const ico = buildIco(buffers);
    const icoPath = join(publicDir, "favicon.ico");
    writeFileSync(icoPath, ico);
    console.log(`Wrote ${icoPath}`);

    // App Router file conventions take precedence over public/ — keep in sync.
    const appDir = join(root, "src", "app");
    writeFileSync(join(appDir, "favicon.ico"), ico);
    console.log(`Wrote ${join(appDir, "favicon.ico")}`);
  }

  const icon192Path = join(iconsDir, "icon-192x192.png");
  if (existsSync(icon192Path)) {
    const appDir = join(root, "src", "app");
    const icon512 = await sharp(icon192Path).resize(512, 512).png().toBuffer();
    writeFileSync(join(appDir, "icon.png"), icon512);
    console.log(`Wrote ${join(appDir, "icon.png")}`);

    const apple180 = await sharp(join(publicDir, "apple-touch-icon.png"))
      .resize(180, 180)
      .png()
      .toBuffer();
    writeFileSync(join(appDir, "apple-icon.png"), apple180);
    console.log(`Wrote ${join(appDir, "apple-icon.png")}`);
  }
}

/** Minimal ICO encoder for 16x16 and 32x32 PNG entries. */
function buildIco(entries) {
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const dirEntrySize = 16;
  const headerAndDir = 6 + dirEntrySize * count;
  let offset = headerAndDir;
  const directory = Buffer.alloc(dirEntrySize * count);
  const images = [];

  entries.forEach(({ size, buffer }, index) => {
    const entryOffset = index * dirEntrySize;
    directory.writeUInt8(size === 256 ? 0 : size, entryOffset);
    directory.writeUInt8(size === 256 ? 0 : size, entryOffset + 1);
    directory.writeUInt8(0, entryOffset + 2);
    directory.writeUInt8(0, entryOffset + 3);
    directory.writeUInt16LE(1, entryOffset + 4);
    directory.writeUInt16LE(32, entryOffset + 6);
    directory.writeUInt32LE(buffer.length, entryOffset + 8);
    directory.writeUInt32LE(offset, entryOffset + 12);
    images.push(buffer);
    offset += buffer.length;
  });

  return Buffer.concat([header, directory, ...images]);
}

async function main() {
  const customerSourcePath = findCustomerSource();
  const adminSourcePath = findAdminSource();
  console.log("Customer PWA icon source:", customerSourcePath ?? "(generated fallback)");
  console.log("Admin PWA icon source:", adminSourcePath ?? "(generated fallback)");

  let customerLogo = null;
  if (customerSourcePath) {
    customerLogo = await prepareLogoSource(customerSourcePath, { admin: false });
    const meta = await customerLogo.clone().metadata();
    console.log("Customer logo crop:", `${meta.width}x${meta.height}`);
  }

  let adminLogo = null;
  if (adminSourcePath) {
    adminLogo = await prepareAdminLogoSource(adminSourcePath);
    const meta = await adminLogo.clone().metadata();
    console.log("Admin logo crop:", `${meta.width}x${meta.height}`);
  } else {
    adminLogo = customerLogo;
  }

  await writeCustomerIconSet(iconsDir, customerLogo);
  await writeAdminIconSet(join(iconsDir, "admin"), adminLogo);
  await writeFavicons(customerLogo);

  console.log("PWA icons generated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
