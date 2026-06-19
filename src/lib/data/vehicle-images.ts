import type { BodyType } from "@/lib/types";
import pool from "./car-photo-pool.json";

export const PLACEHOLDER_IMAGE = "/vehicles/placeholder.svg";

type PhotoPoolKey = keyof typeof pool;

const BODY_POOL: Partial<Record<BodyType, PhotoPoolKey>> = {
  Truck: "Truck",
  Commercial: "Commercial",
};

export function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return h;
}

function poolForBodyType(bodyType?: BodyType): number[] {
  const key = (bodyType && BODY_POOL[bodyType]) || "default";
  return pool[key] ?? pool.default;
}

export function photoIdFor(
  slug: string,
  index: number,
  bodyType?: BodyType
): number {
  const ids = poolForBodyType(bodyType);
  const h = hashSlug(slug);
  return ids[(index + h) % ids.length];
}

/** Center-cropped exterior shot — avoids focal crops that can show people */
export function photoUrlFor(
  slug: string,
  index = 0,
  bodyType?: BodyType
): string {
  const id = photoIdFor(slug, index, bodyType);
  const h = hashSlug(slug);
  const w = 960 + (h % 280);
  const hPx = 640 + ((h >> 4) % 240);
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${hPx}&fit=crop`;
}

export function photosFor(
  slug: string,
  index = 0,
  bodyType?: BodyType
): string[] {
  return [photoUrlFor(slug, index, bodyType)];
}

export function primaryPhotoFor(vehicle: {
  slug: string;
  id: string;
  bodyType: BodyType;
}): string {
  const index = Number.parseInt(vehicle.id, 10) || hashSlug(vehicle.slug);
  return photoUrlFor(vehicle.slug, index, vehicle.bodyType);
}

export const GHANA_PHONE_DISPLAY = "+233 24 487 6784";
export const GHANA_PHONE_TEL = "+233244876784";
export const GHANA_WHATSAPP = "233244876784";
