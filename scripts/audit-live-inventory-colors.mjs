/**
 * Scrape public inventory listing pages to collect slug + primary image + color label.
 * Uses production HTML (no secrets). Output: scripts/.inventory-color-audit.json
 */
import fs from "fs";
import path from "path";

const BASE = process.env.AUDIT_BASE_URL || "https://truegoshen.vercel.app";
const OUT = path.join("scripts", ".inventory-color-audit.json");

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "true-goshen-auto-color-audit/1.0",
      Accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

function decodeNextImageUrl(src) {
  if (!src) return null;
  try {
    const u = new URL(src, BASE);
    if (u.pathname.includes("/_next/image")) {
      const raw = u.searchParams.get("url");
      if (raw) return decodeURIComponent(raw);
    }
    return src.startsWith("http") ? src : new URL(src, BASE).href;
  } catch {
    return src;
  }
}

function extractSlugsFromInventory(html) {
  const slugs = new Set();
  const re = /\/auto\/inventory\/([a-z0-9-]+)/gi;
  let m;
  while ((m = re.exec(html))) {
    const slug = m[1];
    if (slug && slug !== "page" && !slug.includes("?")) slugs.add(slug);
  }
  return [...slugs];
}

function extractFromDetail(html, slug) {
  // Prefer og:image / next image urls for the vehicle
  const images = [];
  const imgRe =
    /(?:src|content)=["']([^"']*(?:pinimg|pexels|cloudinary|supabase|unsplash|images\.|\/vehicles\/)[^"']*)["']/gi;
  let m;
  while ((m = imgRe.exec(html))) {
    const decoded = decodeNextImageUrl(m[1].replace(/&amp;/g, "&"));
    if (decoded && !decoded.includes("logo") && !images.includes(decoded)) {
      images.push(decoded);
    }
  }

  // Also catch encoded next/image urls
  const nextRe = /_next\/image\?url=([^"'&\s]+)/gi;
  while ((m = nextRe.exec(html))) {
    try {
      const decoded = decodeURIComponent(m[1]);
      if (
        decoded.startsWith("http") &&
        !decoded.includes("logo") &&
        !images.includes(decoded)
      ) {
        images.push(decoded);
      }
    } catch {
      /* ignore */
    }
  }

  // Exterior color near label
  let color = null;
  const colorPatterns = [
    /Exterior Color[\s\S]{0,120}?>([^<]{2,40})</i,
    /"color"\s*:\s*"([^"]{2,40})"/i,
    /Exterior Color\s*([A-Za-z][A-Za-z ]{1,30})/i,
  ];
  for (const re of colorPatterns) {
    const cm = html.match(re);
    if (cm?.[1]) {
      const c = cm[1].trim().replace(/\s+/g, " ");
      if (c && !/exterior/i.test(c) && c.length < 40) {
        color = c;
        break;
      }
    }
  }

  // Title
  let title = slug;
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (titleMatch) title = titleMatch[1].trim();

  return {
    slug,
    title,
    color,
    primaryImageUrl: images[0] || null,
    imageUrls: images.slice(0, 6),
  };
}

async function main() {
  const inventoryPages = [];
  // Paginate through inventory
  for (let page = 1; page <= 12; page++) {
    const url =
      page === 1
        ? `${BASE}/auto/inventory`
        : `${BASE}/auto/inventory?page=${page}`;
    try {
      const html = await fetchText(url);
      inventoryPages.push(html);
      const countMatch = html.match(/(\d+)\s+vehicles?\s+found/i);
      if (countMatch && page === 1) {
        console.log(`Reported inventory count: ${countMatch[1]}`);
      }
      // Stop if no vehicle links
      const slugs = extractSlugsFromInventory(html);
      if (slugs.length === 0 && page > 1) break;
    } catch (e) {
      console.warn(`Failed inventory page ${page}: ${e.message}`);
      break;
    }
  }

  const allSlugs = new Set();
  for (const html of inventoryPages) {
    for (const s of extractSlugsFromInventory(html)) allSlugs.add(s);
  }
  console.log(`Found ${allSlugs.size} unique slugs`);

  const vehicles = [];
  const slugs = [...allSlugs].sort();
  const CONCURRENCY = 5;
  for (let i = 0; i < slugs.length; i += CONCURRENCY) {
    const chunk = slugs.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      chunk.map(async (slug) => {
        const html = await fetchText(`${BASE}/auto/inventory/${slug}`);
        return extractFromDetail(html, slug);
      })
    );
    for (let j = 0; j < settled.length; j++) {
      const outcome = settled[j];
      if (outcome.status === "fulfilled") vehicles.push(outcome.value);
      else
        console.warn(
          `Failed ${chunk[j]}: ${outcome.reason?.message || outcome.reason}`
        );
    }
    process.stdout.write(`\rAudited ${Math.min(i + CONCURRENCY, slugs.length)}/${slugs.length}`);
  }
  console.log("");

  const payload = {
    auditedAt: new Date().toISOString(),
    base: BASE,
    count: vehicles.length,
    vehicles,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`Wrote ${vehicles.length} vehicles -> ${OUT}`);

  const missingImg = vehicles.filter((v) => !v.primaryImageUrl).length;
  const missingColor = vehicles.filter((v) => !v.color).length;
  console.log(`Missing image: ${missingImg}, missing color: ${missingColor}`);
  const sample = vehicles.slice(0, 5);
  for (const v of sample) {
    console.log(`- ${v.slug}: color=${v.color} img=${v.primaryImageUrl?.slice(0, 80)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
