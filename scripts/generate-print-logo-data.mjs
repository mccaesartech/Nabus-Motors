import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const logoPath = join(root, "public", "logo-purple.png");
const outPath = join(root, "src", "lib", "print", "print-logo-data.ts");

/** Max width for inline print logo — display is 140px; 280px covers 2× retina PDF. */
const PRINT_LOGO_MAX_WIDTH = 280;

const buffer = await sharp(readFileSync(logoPath))
  .resize({ width: PRINT_LOGO_MAX_WIDTH, withoutEnlargement: true })
  .png({ compressionLevel: 9, palette: false })
  .toBuffer();

const dataUrl = `data:image/png;base64,${buffer.toString("base64")}`;

writeFileSync(
  outPath,
  `/** Auto-generated from public/logo-purple.png — run: node scripts/generate-print-logo-data.mjs */\nexport const PRINT_LOGO_DATA_URL = ${JSON.stringify(dataUrl)};\n`
);

console.log(`Wrote ${outPath} (${buffer.length} bytes, max width ${PRINT_LOGO_MAX_WIDTH}px)`);
