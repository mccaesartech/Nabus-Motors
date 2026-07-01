import type { VehicleInput } from "@/lib/admin/vehicle-fields";
import type { BodyType, VehicleGalleryData } from "@/lib/types";
import pool from "@/lib/data/car-photo-pool.json";
import { hashSlug } from "@/lib/data/vehicle-images";

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

function vehicleSlug(vehicle: Partial<VehicleInput>): string {
  const parts = [
    vehicle.make,
    vehicle.model,
    String(vehicle.year ?? ""),
    vehicle.body_type,
    vehicle.trim,
  ]
    .filter(Boolean)
    .join("-");
  return parts.toLowerCase().replace(/\s+/g, "-") || "listing";
}

function poolIds(key: PhotoPoolKey): number[] {
  return pool[key] ?? pool.default;
}

function exteriorPool(bodyType?: string): number[] {
  const key = (bodyType && BODY_POOL[bodyType as BodyType]) || "default";
  return poolIds(key);
}

function pexelsUrl(id: number, seed: string, offset: number): string {
  const h = hashSlug(`${seed}-${offset}`);
  const w = 960 + (h % 280);
  const hPx = 640 + ((h >> 4) % 240);
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${hPx}&fit=crop`;
}

function pickUrls(ids: number[], slug: string, count: number, startOffset = 0): string[] {
  const h = hashSlug(slug);
  const urls: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = ids[(startOffset + i + h) % ids.length];
    urls.push(pexelsUrl(id, slug, i));
  }
  return [...new Set(urls)];
}

/** Deterministic stock photo URLs from Pexels — placeholders, not photos of this exact car. */
export function suggestStockPhotos(vehicle: Partial<VehicleInput>): VehicleGalleryData {
  const slug = vehicleSlug(vehicle);
  const exteriorIds = exteriorPool(vehicle.body_type);
  const interiorIds = poolIds("interior");
  const engineIds = poolIds("engine");

  return {
    exterior: pickUrls(exteriorIds, slug, 3, 0),
    interior: pickUrls(interiorIds, `${slug}-interior`, 3, 0),
    engine: pickUrls(engineIds, `${slug}-engine`, 2, 0),
    other: pickUrls(exteriorIds, `${slug}-other`, 1, 4),
  };
}
