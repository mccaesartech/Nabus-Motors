/**
 * Canonical exterior colors + swatches for inventory display and admin editors.
 * Stock Pexels placeholders are annotated in car-photo-colors.json so labels
 * match the cars shown in those images.
 */

import photoColors from "@/lib/data/car-photo-colors.json";
import inventoryPhotoColors from "@/lib/data/inventory-photo-colors.json";

export type VehicleColorOption = {
  label: string;
  hex: string;
};

const INVENTORY_PHOTO_COLOR_BY_SLUG = inventoryPhotoColors as Record<string, string>;

/** Canonical exterior colors used in seed, admin, and swatches. */
export const VEHICLE_COLOR_OPTIONS: readonly VehicleColorOption[] = [
  { label: "Pearl White", hex: "#F2F0EA" },
  { label: "Silver Frost", hex: "#C5CAD0" },
  { label: "Atomic Grey", hex: "#8B8E93" },
  { label: "Graphite Grey", hex: "#5C5F64" },
  { label: "Midnight Black", hex: "#1C1C1E" },
  { label: "Obsidian Black", hex: "#0B0B0C" },
  { label: "Deep Blue", hex: "#1E3A5F" },
  { label: "Deep Green", hex: "#2E413E" },
  { label: "Champagne Gold", hex: "#C5A572" },
  { label: "Radiant Red", hex: "#8B1E1E" },
] as const;

const OPTIONS_BY_NORMALIZED = new Map(
  VEHICLE_COLOR_OPTIONS.map((opt) => [normalizeColorKey(opt.label), opt])
);

const PHOTO_COLOR_BY_ID = photoColors as Record<string, string>;

export function normalizeColorKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

export function isCanonicalVehicleColor(value: string): boolean {
  return OPTIONS_BY_NORMALIZED.has(normalizeColorKey(value));
}

export function swatchHexForColor(color: string | null | undefined): string | null {
  if (!color?.trim()) return null;
  const match = OPTIONS_BY_NORMALIZED.get(normalizeColorKey(color));
  return match?.hex ?? null;
}

export function colorLabelForPhotoId(photoId: number | string | null | undefined): string | null {
  if (photoId == null || photoId === "") return null;
  const label = PHOTO_COLOR_BY_ID[String(photoId)];
  return label?.trim() || null;
}

/** Extract a Pexels photo id from a stock image URL, if present. */
export function pexelsPhotoIdFromUrl(url: string | null | undefined): number | null {
  if (!url?.trim()) return null;
  const match = url.match(/pexels\.com\/photos\/(\d+)\//i);
  if (!match) return null;
  const id = Number.parseInt(match[1], 10);
  return Number.isFinite(id) ? id : null;
}

export function colorLabelForImageUrl(url: string | null | undefined): string | null {
  return colorLabelForPhotoId(pexelsPhotoIdFromUrl(url));
}

function primaryImageCandidate(vehicle: {
  color?: string | null;
  primaryImageUrl?: string | null;
  primary_image_url?: string | null;
  additionalImages?: string[] | null;
  additional_images?: string[] | null;
  gallery?: { exterior?: string[] } | null;
  images?: string[] | null;
}): string | undefined {
  const explicit = (vehicle.primary_image_url ?? vehicle.primaryImageUrl)?.trim();
  if (explicit) return explicit;
  const exterior = vehicle.gallery?.exterior?.find((url) => Boolean(url?.trim()));
  if (exterior) return exterior.trim();
  const legacy = vehicle.images?.find((url) => Boolean(url?.trim()));
  return legacy?.trim();
}

/**
 * Exterior color shown to customers.
 * Known stock-placeholder photos win over a mismatched stored label so the
 * description matches the car in the image. Audited custom listing photos
 * (Pinterest/CDN) use the photo→color map when present, then fall back to DB.
 */
export function resolveExteriorColor(vehicle: {
  slug?: string | null;
  color?: string | null;
  primaryImageUrl?: string | null;
  primary_image_url?: string | null;
  additionalImages?: string[] | null;
  additional_images?: string[] | null;
  gallery?: { exterior?: string[] } | null;
  images?: string[] | null;
}): string {
  const fromStock = colorLabelForImageUrl(primaryImageCandidate(vehicle));
  if (fromStock) return fromStock;

  const slug = vehicle.slug?.trim();
  if (slug) {
    const fromInventoryPhoto = INVENTORY_PHOTO_COLOR_BY_SLUG[slug]?.trim();
    if (fromInventoryPhoto) return fromInventoryPhoto;
  }

  const stored = vehicle.color?.trim();
  return stored ?? "";
}

export function photoIdsMatchingColor(
  photoIds: number[],
  preferredColor: string | null | undefined
): number[] {
  if (!preferredColor?.trim()) return [];
  const key = normalizeColorKey(preferredColor);
  return photoIds.filter((id) => {
    const label = colorLabelForPhotoId(id);
    return label != null && normalizeColorKey(label) === key;
  });
}

export function countStockPhotoColorMismatches(
  vehicles: Array<{
    color?: string | null;
    images?: string[] | null;
    primaryImageUrl?: string | null;
    primary_image_url?: string | null;
  }>
): { total: number; mismatched: number; matched: number; unknownStock: number } {
  let mismatched = 0;
  let matched = 0;
  let unknownStock = 0;

  for (const vehicle of vehicles) {
    const photoId = pexelsPhotoIdFromUrl(primaryImageCandidate(vehicle));
    if (photoId == null) continue;
    const expected = colorLabelForPhotoId(photoId);
    if (!expected) {
      unknownStock += 1;
      continue;
    }
    const stored = vehicle.color?.trim() ?? "";
    if (!stored || normalizeColorKey(stored) !== normalizeColorKey(expected)) {
      mismatched += 1;
    } else {
      matched += 1;
    }
  }

  return {
    total: mismatched + matched + unknownStock,
    mismatched,
    matched,
    unknownStock,
  };
}
