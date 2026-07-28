import type { VehicleInput } from "@/lib/admin/vehicle-fields";
import { VEHICLE_STATUS_LABELS } from "@/lib/admin/vehicle-fields";
import { isValidImageUrl } from "@/lib/data/vehicle-images";
import { DEFAULT_DISPLAY_CURRENCY } from "@/lib/currency";

export type VehiclePublishSummary = {
  title: string;
  price: number;
  priceCurrency: string;
  mileage: number;
  color: string;
  status: string;
  statusLabel: string;
  location: string;
  bodyType: string;
  fuelType: string;
  transmission: string;
  condition: string;
  primaryImageUrl: string;
  photoCount: number;
  featured: boolean;
};

export function listingImageUrls(input: Partial<VehicleInput>): string[] {
  const urls: string[] = [];
  const primary = input.primary_image_url?.trim();
  if (primary && isValidImageUrl(primary)) urls.push(primary);

  for (const url of input.additional_images ?? []) {
    const trimmed = url?.trim();
    if (trimmed && isValidImageUrl(trimmed) && !urls.includes(trimmed)) {
      urls.push(trimmed);
    }
  }

  for (const url of input.images ?? []) {
    const trimmed = url?.trim();
    if (trimmed && isValidImageUrl(trimmed) && !urls.includes(trimmed)) {
      urls.push(trimmed);
    }
  }

  const gallery = input.gallery;
  if (gallery) {
    for (const key of ["exterior", "interior", "engine", "other"] as const) {
      for (const url of gallery[key] ?? []) {
        const trimmed = url?.trim();
        if (trimmed && isValidImageUrl(trimmed) && !urls.includes(trimmed)) {
          urls.push(trimmed);
        }
      }
    }
  }

  return urls;
}

export function requirePrimaryVehicleImage(
  input: Partial<VehicleInput>
): string | null {
  const urls = listingImageUrls(input);
  if (urls.length === 0) {
    return "Add at least one photo of the actual vehicle before submitting.";
  }
  const primary = input.primary_image_url?.trim();
  if (!primary || !isValidImageUrl(primary)) {
    return "Add a primary vehicle photo before submitting.";
  }
  return null;
}

export function buildVehiclePublishSummary(
  input: Partial<VehicleInput>
): VehiclePublishSummary {
  const urls = listingImageUrls(input);
  const status = String(input.status ?? "available");
  return {
    title: [input.year, input.make, input.model, input.trim]
      .filter((part) => part !== undefined && String(part).trim() !== "")
      .join(" "),
    price: Number(input.price) || 0,
    priceCurrency:
      String(input.price_currency || DEFAULT_DISPLAY_CURRENCY).toUpperCase() ||
      DEFAULT_DISPLAY_CURRENCY,
    mileage: Number(input.mileage) || 0,
    color: String(input.color ?? "").trim() || "Not set",
    status,
    statusLabel:
      VEHICLE_STATUS_LABELS[status as keyof typeof VEHICLE_STATUS_LABELS] ?? status,
    location: String(input.location ?? "").trim() || "Not set",
    bodyType: String(input.body_type ?? "").trim() || "Not set",
    fuelType: String(input.fuel_type ?? "").trim() || "Not set",
    transmission: String(input.transmission ?? "").trim() || "Not set",
    condition: String(input.condition ?? "").trim() || "Not set",
    primaryImageUrl: urls[0] ?? "",
    photoCount: urls.length,
    featured: Boolean(input.featured),
  };
}

/** Owner/super-admin publishes go live immediately and must confirm first. */
export function rolePublishesImmediately(role: string | null | undefined): boolean {
  return role === "owner" || role === "super_admin";
}
