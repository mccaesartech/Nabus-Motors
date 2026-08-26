import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createCanvas } from "@napi-rs/canvas";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pdfPath = path.join(root, "public/documents/true-goshen-letterhead.pdf");
const pngPath = path.join(root, "public/documents/true-goshen-letterhead.png");
const webpPath = path.join(root, "public/documents/true-goshen-letterhead.webp");
const continuationPath = path.join(
  root,
  "public/documents/true-goshen-letterhead-continuation.png"
);
const continuationWebpPath = path.join(
  root,
  "public/documents/true-goshen-letterhead-continuation.webp"
);
const dataPath = path.join(root, "src/lib/print/letterhead-data.ts");

const RENDER_DPI = 150;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const SCALE = RENDER_DPI / 25.4;
const WIDTH = Math.round(A4_WIDTH_MM * SCALE);

/** Navy / accent pixels in header & footer bands (letterhead brand blues). */
function isBrandPixel(r, g, b, a) {
  if (a < 16) return false;
  if (r > 245 && g > 245 && b > 245) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 18 && max > 210) return false;
  return b >= 60 && r <= 120;
}

function rowScore(data, width, y, predicate) {
  let hits = 0;
  const offset = y * width * 4;
  for (let x = 0; x < width; x++) {
    const i = offset + x * 4;
    if (predicate(data[i], data[i + 1], data[i + 2], data[i + 3])) hits++;
  }
  return hits / width;
}

function detectSafeZone(raw, width, height) {
  const brandThreshold = 0.02;
  const scanHeaderTo = Math.round(height * 0.22);
  const scanFooterFrom = Math.round(height * 0.72);

  let headerEndPx = Math.round(height * 0.16);
  for (let y = 0; y < scanHeaderTo; y++) {
    const brand = rowScore(raw, width, y, isBrandPixel);
    if (brand >= brandThreshold) headerEndPx = y;
  }

  let footerStartPx = Math.round(height * 0.85);
  let inFooter = false;
  for (let y = height - 1; y >= scanFooterFrom; y--) {
    const brand = rowScore(raw, width, y, isBrandPixel);
    if (brand >= brandThreshold) {
      inFooter = true;
      footerStartPx = y;
    } else if (inFooter) {
      // Left the footer band while scanning upward — keep the top of that band.
      break;
    }
  }

  const padPx = Math.round(10 * SCALE);
  const topPx = Math.min(height - 1, headerEndPx + padPx);
  const bottomPx = Math.max(topPx + 1, height - footerStartPx + padPx);

  const topMm = Math.round((topPx / height) * A4_HEIGHT_MM);
  const bottomMm = Math.round((bottomPx / height) * A4_HEIGHT_MM);
  const leftMm = 16;
  const rightMm = 16;

  return {
    topPx,
    bottomPx,
    headerEndPx,
    footerStartPx,
    topMm: Math.max(46, Math.min(topMm, 52)),
    bottomMm: Math.max(40, Math.min(bottomMm, 48)),
    leftMm,
    rightMm,
    width,
    height,
  };
}

async function whiteRect(width, height) {
  return sharp({
    create: {
      width,
      height: Math.max(1, height),
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

/** Pixels reserved for footer art — matches LETTERHEAD_SAFE_ZONE.bottomMm. */
function footerKeepPx(zone) {
  return Math.max(
    1,
    Math.round((zone.bottomMm / A4_HEIGHT_MM) * zone.height)
  );
}

/**
 * Page-1 letterhead: keep header + footer, erase the center TG watermark by
 * whitening the body band between the header safe edge and the footer keep zone.
 */
async function removeCenterWatermark(fullPngBuffer, zone) {
  const bodyTop = zone.topPx;
  const bodyBottom = Math.max(bodyTop + 1, zone.height - footerKeepPx(zone));
  const bodyHeight = Math.max(1, bodyBottom - bodyTop);
  const whiteBody = await whiteRect(zone.width, bodyHeight);

  return sharp(fullPngBuffer)
    .composite([{ input: whiteBody, top: bodyTop, left: 0 }])
    .png()
    .toBuffer();
}

/**
 * Continuation pages: footer branding only (no header, no center watermark).
 */
async function buildContinuationPng(fullPngBuffer, zone) {
  const clearHeight = Math.max(1, zone.height - footerKeepPx(zone));
  const whiteAboveFooter = await whiteRect(zone.width, clearHeight);

  return sharp(fullPngBuffer)
    .composite([{ input: whiteAboveFooter, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

async function renderPdfPage() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: WIDTH / page.getViewport({ scale: 1 }).width });
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toBuffer("image/png");
}

async function main() {
  if (!fs.existsSync(pdfPath)) throw new Error(`Letterhead PDF not found: ${pdfPath}`);
  console.log("Rendering letterhead page 1...");
  const renderedBuffer = await renderPdfPage();

  const meta = await sharp(renderedBuffer).metadata();
  const width = meta.width ?? WIDTH;
  const height = meta.height ?? 0;
  const { data: raw } = await sharp(renderedBuffer).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });

  const zone = detectSafeZone(raw, width, height);

  console.log(
    `Safe zone: top ${zone.topMm}mm (${zone.topPx}px), bottom ${zone.bottomMm}mm, left/right ${zone.leftMm}mm`
  );
  const keep = Math.round((zone.bottomMm / A4_HEIGHT_MM) * height);
  console.log(
    `Watermark clear: y ${zone.topPx}→${height - keep} (keep footer ${keep}px / ${zone.bottomMm}mm)`
  );

  const pngBuffer = await removeCenterWatermark(renderedBuffer, zone);
  fs.writeFileSync(pngPath, pngBuffer);

  const continuationBuffer = await buildContinuationPng(pngBuffer, zone);
  fs.writeFileSync(continuationPath, continuationBuffer);

  const webpBuffer = await sharp(pngBuffer).webp({ quality: 92 }).toBuffer();
  fs.writeFileSync(webpPath, webpBuffer);

  const continuationWebpBuffer = await sharp(continuationBuffer)
    .webp({ quality: 92 })
    .toBuffer();
  fs.writeFileSync(continuationWebpPath, continuationWebpBuffer);

  const base64 = pngBuffer.toString("base64");
  const continuationBase64 = continuationBuffer.toString("base64");

  const tsContent = `/** Auto-generated from public/documents/true-goshen-letterhead.pdf - run: npm run letterhead */
export const LETTERHEAD_DATA_URL = "data:image/png;base64,${base64}";
export const LETTERHEAD_CONTINUATION_DATA_URL = "data:image/png;base64,${continuationBase64}";
export const LETTERHEAD_WIDTH = ${width};
export const LETTERHEAD_HEIGHT = ${height};
export const LETTERHEAD_PDF_PATH = "/documents/true-goshen-letterhead.pdf";
export const LETTERHEAD_PNG_PATH = "/documents/true-goshen-letterhead.png";
export const LETTERHEAD_WEBP_PATH = "/documents/true-goshen-letterhead.webp";
export const LETTERHEAD_CONTINUATION_PNG_PATH = "/documents/true-goshen-letterhead-continuation.png";
export const LETTERHEAD_CONTINUATION_WEBP_PATH = "/documents/true-goshen-letterhead-continuation.webp";
export const LETTERHEAD_SAFE_ZONE = { topMm: ${zone.topMm}, bottomMm: ${zone.bottomMm}, leftMm: ${zone.leftMm}, rightMm: ${zone.rightMm} } as const;
`;

  fs.writeFileSync(dataPath, tsContent);
  console.log(`Wrote ${pngPath} (${pngBuffer.length} bytes, ${width}x${height})`);
  console.log(`Wrote ${continuationPath} (${continuationBuffer.length} bytes)`);
  console.log(`Wrote ${webpPath} (${webpBuffer.length} bytes)`);
  console.log(`Wrote ${continuationWebpPath} (${continuationWebpBuffer.length} bytes)`);
  console.log(`Wrote ${dataPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
