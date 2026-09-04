import type {
  BodyType,
  VehicleGalleryData,
  VehicleImageCategory,
} from "@/lib/types";
import { EMPTY_VEHICLE_GALLERY, VEHICLE_GALLERY_ORDER } from "@/lib/types";
import { photoIdsMatchingColor } from "@/lib/vehicles/vehicle-colors";
import pool from "./car-photo-pool.json";

export const PLACEHOLDER_IMAGE = "/vehicles/placeholder.svg";

export const GALLERY_SECTION_LABELS: Record<VehicleImageCategory, string> = {
  exterior: "Exterior",
  interior: "Interior",
  engine: "Engine & details",
  other: "More photos",
};

type PhotoPoolKey = keyof typeof pool;

const BODY_POOL: Partial<Record<BodyType, PhotoPoolKey>> = {
  SUV: "SUV",
  Sedan: "Sedan",
  Luxury: "Luxury",
  Truck: "Truck",
  Commercial: "Commercial",
  Electric: "Electric",
  Hatchback: "Hatchback",
  Coupe: "Coupe",
};

const CATEGORY_POOL_OVERRIDE: Partial<Record<string, PhotoPoolKey>> = {
  chinese: "chinese",
};

/** Verified Pexels IDs for browse-by-category cards (car-only, matched to body type). */
const BROWSE_CATEGORY_PHOTO_IDS: Record<string, number> = {
  suv: 14776590,
  sedan: 12681049,
  luxury: 30360699,
  truck: 24482667,
  commercial: 16363816,
  electric: 9800029,
  chinese: 32078946,
};

function pexelsPhotoUrl(id: number, seed: string): string {
  const h = hashSlug(seed);
  const w = 960 + (h % 280);
  const hPx = 640 + ((h >> 4) % 240);
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${hPx}&fit=crop`;
}

export function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return h;
}

function poolIds(key: PhotoPoolKey): number[] {
  return pool[key] ?? pool.default;
}

function poolForBodyType(bodyType?: BodyType): number[] {
  const key = (bodyType && BODY_POOL[bodyType]) || "default";
  return poolIds(key);
}

function poolForCategory(categoryId: string, slug: string): number[] {
  const override = CATEGORY_POOL_OVERRIDE[categoryId];
  if (override) return poolIds(override);
  const bodyType = slug.trim() as BodyType;
  if (bodyType && BODY_POOL[bodyType]) return poolIds(BODY_POOL[bodyType]);
  return poolIds("default");
}

/** Stock photo for a browse-by-category card when no custom image is set. */
export function categoryPhotoUrlFor(categoryId: string, slug: string): string {
  const primaryId = BROWSE_CATEGORY_PHOTO_IDS[categoryId];
  if (primaryId) {
    return pexelsPhotoUrl(primaryId, `category-${categoryId}`);
  }

  const ids = poolForCategory(categoryId, slug);
  const h = hashSlug(`category-${categoryId}`);
  const id = ids[h % ids.length];
  return pexelsPhotoUrl(id, `category-${categoryId}`);
}

export function photoIdFor(
  slug: string,
  index: number,
  bodyType?: BodyType,
  preferredColor?: string | null
): number {
  const ids = poolForBodyType(bodyType);
  const h = hashSlug(slug);
  const matching = photoIdsMatchingColor(ids, preferredColor);
  const poolIdsToUse = matching.length > 0 ? matching : ids;
  return poolIdsToUse[(index + h) % poolIdsToUse.length];
}

/** Center-cropped exterior shot — avoids focal crops that can show people */
export function photoUrlFor(
  slug: string,
  index = 0,
  bodyType?: BodyType,
  preferredColor?: string | null
): string {
  const id = photoIdFor(slug, index, bodyType, preferredColor);
  return pexelsPhotoUrl(id, slug);
}

export function isValidImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return !trimmed.includes(" ");
  }
  try {
    const toParse = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
    const parsed = new URL(toParse);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeUrls(urls?: string[]): string[] {
  return (urls ?? []).filter(isValidImageUrl).map((s) => s.trim());
}

function poolPhotoFor(
  slug: string,
  id: string,
  bodyType?: BodyType,
  preferredColor?: string | null
): string {
  const index = Number.parseInt(id, 10) || hashSlug(slug);
  return photoUrlFor(slug, index, bodyType, preferredColor);
}

export function sanitizeGallery(
  gallery?: Partial<VehicleGalleryData> | null
): VehicleGalleryData {
  return {
    exterior: sanitizeUrls(gallery?.exterior),
    interior: sanitizeUrls(gallery?.interior),
    engine: sanitizeUrls(gallery?.engine),
    other: sanitizeUrls(gallery?.other),
  };
}

export function galleryHasImages(gallery: VehicleGalleryData): boolean {
  return VEHICLE_GALLERY_ORDER.some((key) => gallery[key].length > 0);
}

/** Resolve gallery from JSONB + legacy images[] (all legacy → exterior). */
export function resolveVehicleGallery(vehicle: {
  gallery?: VehicleGalleryData | Partial<VehicleGalleryData> | null;
  images?: string[];
}): VehicleGalleryData {
  const sanitized = sanitizeGallery(vehicle.gallery);
  if (galleryHasImages(sanitized)) return sanitized;

  const legacy = sanitizeUrls(vehicle.images);
  if (legacy.length > 0) {
    return { ...EMPTY_VEHICLE_GALLERY, exterior: legacy };
  }

  return { ...EMPTY_VEHICLE_GALLERY };
}

export function flattenGallery(gallery: VehicleGalleryData): string[] {
  return VEHICLE_GALLERY_ORDER.flatMap((key) => gallery[key]);
}

export function galleryForVehicle(vehicle: {
  gallery?: VehicleGalleryData | Partial<VehicleGalleryData> | null;
  images?: string[];
}): VehicleGalleryData {
  return resolveVehicleGallery(vehicle);
}

export type GallerySection = {
  key: VehicleImageCategory;
  label: string;
  images: string[];
};

export function gallerySectionsFor(vehicle: {
  gallery?: VehicleGalleryData | Partial<VehicleGalleryData> | null;
  images?: string[];
}): GallerySection[] {
  const gallery = resolveVehicleGallery(vehicle);
  return VEHICLE_GALLERY_ORDER.map((key) => ({
    key,
    label: GALLERY_SECTION_LABELS[key],
    images: gallery[key],
  })).filter((section) => section.images.length > 0);
}

export function sectionForImageIndex(
  sections: GallerySection[],
  index: number
): GallerySection | null {
  let offset = 0;
  for (const section of sections) {
    if (index < offset + section.images.length) return section;
    offset += section.images.length;
  }
  return null;
}

export function photosFor(
  slug: string,
  index = 0,
  bodyType?: BodyType,
  images?: string[],
  preferredColor?: string | null
): string[] {
  const fromDb = sanitizeUrls(images);
  if (fromDb.length > 0) return fromDb;
  return [photoUrlFor(slug, index, bodyType, preferredColor)];
}

export function vehicleImagesFor(vehicle: {
  slug: string;
  id: string;
  bodyType: BodyType;
  gallery?: VehicleGalleryData | Partial<VehicleGalleryData> | null;
  images?: string[];
}): string[] {
  const gallery = resolveVehicleGallery(vehicle);
  const flat = flattenGallery(gallery);
  if (flat.length > 0) return flat;
  return [poolPhotoFor(vehicle.slug, vehicle.id, vehicle.bodyType)];
}

export function resolvePrimaryImageUrl(vehicle: {
  primary_image_url?: string | null;
  primaryImageUrl?: string | null;
  gallery?: VehicleGalleryData | Partial<VehicleGalleryData> | null;
  images?: string[];
}): string | undefined {
  const explicit = (vehicle.primary_image_url ?? vehicle.primaryImageUrl)?.trim();
  if (explicit && isValidImageUrl(explicit)) return explicit;

  const gallery = resolveVehicleGallery(vehicle);
  if (gallery.exterior.length > 0) return gallery.exterior[0];

  const flat = flattenGallery(gallery);
  if (flat.length > 0) return flat[0];

  const legacy = sanitizeUrls(vehicle.images);
  if (legacy.length > 0) return legacy[0];

  return undefined;
}

export function resolveAdditionalImages(vehicle: {
  primary_image_url?: string | null;
  primaryImageUrl?: string | null;
  additional_images?: string[] | null;
  additionalImages?: string[] | null;
  gallery?: VehicleGalleryData | Partial<VehicleGalleryData> | null;
  images?: string[];
}): string[] {
  const fromColumn = sanitizeUrls(vehicle.additional_images ?? vehicle.additionalImages ?? undefined);
  if (fromColumn.length > 0) return fromColumn;

  const primary = resolvePrimaryImageUrl(vehicle);
  const gallery = resolveVehicleGallery(vehicle);
  const flat = flattenGallery(gallery);
  if (flat.length > 0) {
    return flat.filter((url) => url !== primary);
  }

  const legacy = sanitizeUrls(vehicle.images);
  if (legacy.length > 1) {
    return legacy.filter((url) => url !== primary);
  }

  return [];
}

export function galleryToPrimaryAndAdditional(vehicle: {
  gallery?: VehicleGalleryData | Partial<VehicleGalleryData> | null;
  images?: string[];
}): { primaryImageUrl: string; additionalImages: string[] } {
  const primary = resolvePrimaryImageUrl(vehicle) ?? "";
  return {
    primaryImageUrl: primary,
    additionalImages: resolveAdditionalImages(vehicle),
  };
}

export function primaryAndAdditionalToGallery(
  primaryImageUrl: string,
  additionalImages: string[]
): VehicleGalleryData {
  const primary = primaryImageUrl.trim();
  const additional = sanitizeUrls(additionalImages).filter((url) => url !== primary);
  return {
    exterior: primary ? [primary] : [],
    interior: [],
    engine: [],
    other: additional,
  };
}

export function primaryPhotoFor(vehicle: {
  slug: string;
  id: string;
  bodyType: BodyType;
  primary_image_url?: string | null;
  primaryImageUrl?: string | null;
  additional_images?: string[] | null;
  additionalImages?: string[] | null;
  gallery?: VehicleGalleryData | Partial<VehicleGalleryData> | null;
  images?: string[];
}): string {
  const resolved = resolvePrimaryImageUrl(vehicle);
  if (resolved) return resolved;
  return poolPhotoFor(vehicle.slug, vehicle.id, vehicle.bodyType);
}

export const GHANA_PHONE_DISPLAY = "+233 27 994 0200";
export const GHANA_PHONE_TEL = "+233279940200";
export const GHANA_WHATSAPP = "233279940200";
