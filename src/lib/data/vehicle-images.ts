/** Local vehicle photos — unique Pexels URL per vehicle slug (no duplicate stock pool) */
export const PLACEHOLDER_IMAGE = "/vehicles/placeholder.svg";

/** Verified exterior-only car/truck photos (no people, hands, or toy-road scenes). */
const CAR_ONLY_IDS = [
  170811, 210019, 3802510, 799443, 919073, 116675, 279949, 3802508,
  112460, 110844, 164634, 1149137, 3764984, 1638119, 2430032,
  1149831, 2361492, 1934851, 1007770, 120049, 6870896,
];

export function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function photoUrlFor(slug: string, index = 0): string {
  const h = hashSlug(slug);
  const id = CAR_ONLY_IDS[(index + h) % CAR_ONLY_IDS.length];
  const w = 960 + (h % 320);
  const hPx = 640 + ((h >> 4) % 280);
  const fpX = 0.15 + (h % 70) / 100;
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${hPx}&fit=crop&crop=focalpoint&fp-x=${fpX.toFixed(2)}&fp-y=0.5`;
}

export function photosFor(slug: string, index = 0): string[] {
  return [photoUrlFor(slug, index)];
}

export const GHANA_PHONE_DISPLAY = "+233 24 487 6784";
export const GHANA_PHONE_TEL = "+233244876784";
export const GHANA_WHATSAPP = "233244876784";
