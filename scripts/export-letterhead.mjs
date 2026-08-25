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
const dataPath = path.join(root, "src/lib/print/letterhead-data.ts");

const RENDER_DPI = 150;
const A4_WIDTH_MM = 210;
const SCALE = RENDER_DPI / 25.4;
const WIDTH = Math.round(A4_WIDTH_MM * SCALE);

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
  const pngBuffer = await renderPdfPage();
  fs.writeFileSync(pngPath, pngBuffer);
  const webpBuffer = await sharp(pngBuffer).webp({ quality: 92 }).toBuffer();
  fs.writeFileSync(webpPath, webpBuffer);
  const meta = await sharp(pngBuffer).metadata();
  const base64 = pngBuffer.toString("base64");
  const tsContent = `/** Auto-generated from public/documents/true-goshen-letterhead.pdf - run: node scripts/export-letterhead.mjs */
export const LETTERHEAD_DATA_URL = "data:image/png;base64,${base64}";
export const LETTERHEAD_WIDTH = ${meta.width ?? WIDTH};
export const LETTERHEAD_HEIGHT = ${meta.height ?? 0};
export const LETTERHEAD_PDF_PATH = "/documents/true-goshen-letterhead.pdf";
export const LETTERHEAD_PNG_PATH = "/documents/true-goshen-letterhead.png";
export const LETTERHEAD_WEBP_PATH = "/documents/true-goshen-letterhead.webp";
export const LETTERHEAD_SAFE_ZONE = { topMm: 48, bottomMm: 28, leftMm: 18, rightMm: 18 } as const;
`;
  fs.writeFileSync(dataPath, tsContent);
  console.log(`Wrote ${pngPath} (${pngBuffer.length} bytes, ${meta.width}x${meta.height})`);
  console.log(`Wrote ${webpPath} (${webpBuffer.length} bytes)`);
  console.log(`Wrote ${dataPath}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
