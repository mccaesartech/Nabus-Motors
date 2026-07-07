import type { VehicleInput } from "./vehicle-fields";
import { DEFAULT_TRUST_BADGES } from "@/lib/vehicles/trust-badges";
import {
  galleryFromInput,
  imagesFromGallery,
  primaryAndAdditionalFromVehicle,
  syncVehicleImagesFromPrimaryAndAdditional,
} from "./vehicle-fields";

export function rowFromInput(
  input: VehicleInput,
  slug: string
): Record<string, unknown> {
  const { primaryImageUrl, additionalImages } =
    input.primary_image_url !== undefined || input.additional_images !== undefined
      ? {
          primaryImageUrl: input.primary_image_url ?? "",
          additionalImages: input.additional_images ?? [],
        }
      : primaryAndAdditionalFromVehicle(input);

  const synced = syncVehicleImagesFromPrimaryAndAdditional(
    primaryImageUrl,
    additionalImages
  );
  const gallery = synced.gallery ?? galleryFromInput(input.gallery, input.images);
  const images = synced.images ?? imagesFromGallery(gallery);

  return {
    slug,
    make: input.make.trim(),
    model: input.model.trim(),
    year: Number(input.year),
    trim: input.trim?.trim() || null,
    price: Number(input.price),
    mileage: Number(input.mileage),
    fuel_type: input.fuel_type,
    transmission: input.transmission,
    condition: input.condition,
    body_type: input.body_type,
    location: input.location,
    engine_size: input.engine_size?.trim() || null,
    color: input.color?.trim() || null,
    vin: input.vin?.trim() || null,
    description:
      input.description?.trim() ||
      `${input.year} ${input.make} ${input.model} — verified and ready for delivery across Ghana.`,
    featured: Boolean(input.featured),
    primary_image_url: synced.primary_image_url || null,
    additional_images: synced.additional_images ?? [],
    images,
    gallery,
    specs: [],
    history: [
      {
        date: new Date().toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
        title: "Listed",
        description: "Added to True Goshen inventory",
      },
    ],
    status: input.status || "available",
    trust_badges: input.trust_badges ?? DEFAULT_TRUST_BADGES,
    inspection_summary: input.inspection_summary?.trim() || null,
    country_of_origin: input.country_of_origin?.trim() || null,
    financing_available: input.financing_available !== false,
    shipment_available: input.shipment_available !== false,
    customs_clearing_available: input.customs_clearing_available !== false,
    warranty_notes: input.warranty_notes?.trim() || null,
    walkaround_video_url: input.walkaround_video_url?.trim() || null,
    available_locally: Boolean(input.available_locally),
  };
}

export function validateVehicleInput(
  input: Partial<VehicleInput>
): { ok: true; data: VehicleInput } | { ok: false; message: string } {
  if (!input.make?.trim()) return { ok: false, message: "Make is required." };
  if (!input.model?.trim()) return { ok: false, message: "Model is required." };
  if (!input.year || input.year < 1990 || input.year > 2030) {
    return { ok: false, message: "Enter a valid year (1990–2030)." };
  }
  if (input.price === undefined || input.price < 0) {
    return { ok: false, message: "Price is required." };
  }
  if (input.mileage === undefined || input.mileage < 0) {
    return { ok: false, message: "Mileage is required." };
  }
  if (!input.location?.trim()) return { ok: false, message: "Location is required." };

  return { ok: true, data: input as VehicleInput };
}
