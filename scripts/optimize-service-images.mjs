/**
 * Resize service card JPGs to ~900px wide for 12cm display cards.
 * Run: node scripts/optimize-service-images.mjs
 */
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const servicesDir = path.join(process.cwd(), "public", "images", "services");
const maxWidth = 900;
const quality = 78;

async function optimizeFile(filePath) {
  const info = await stat(filePath);
  const beforeKb = Math.round(info.size / 1024);

  const buffer = await sharp(filePath)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

  await sharp(buffer).toFile(filePath);
  const afterKb = Math.round(buffer.length / 1024);
  console.log(`${path.basename(filePath)}: ${beforeKb}KB → ${afterKb}KB`);
}

async function main() {
  let entries;
  try {
    entries = await readdir(servicesDir);
  } catch {
    console.warn(`No directory at ${servicesDir} — nothing to optimize.`);
    return;
  }

  const images = entries.filter((name) => /\.(jpe?g|png)$/i.test(name));
  if (images.length === 0) {
    console.warn("No service images found.");
    return;
  }

  for (const name of images) {
    await optimizeFile(path.join(servicesDir, name));
  }

  console.log(`Optimized ${images.length} service image(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
