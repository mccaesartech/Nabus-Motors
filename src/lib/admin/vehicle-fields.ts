import type {
  BodyType,
  Condition,
  FuelType,
  Transmission,
  VehicleGalleryData,
} from "@/lib/types";
import { EMPTY_VEHICLE_GALLERY } from "@/lib/types";
import { galleryForVehicle, flattenGallery } from "@/lib/data/vehicle-images";
import { locations } from "@/lib/data/catalog-meta";

export type VehicleInput = {
  make: string;
  model: string;
  year: number;
  trim?: string;
  price: number;
  mileage: number;
  fuel_type: FuelType | string;
  transmission: Transmission | string;
  condition: Condition | string;
  body_type: BodyType | string;
  location: string;
  engine_size?: string;
  color?: string;
  vin?: string;
  description?: string;
  featured?: boolean;
  status?: string;
  images?: string[];
  gallery?: VehicleGalleryData;
};

export const BODY_TYPES: BodyType[] = [
  "SUV",
  "Sedan",
  "Luxury",
  "Truck",
  "Commercial",
  "Electric",
  "Coupe",
  "Hatchback",
];

export const FUEL_TYPES: FuelType[] = [
  "Petrol",
  "Diesel",
  "Hybrid",
  "Electric",
  "Plug-in Hybrid",
];

export const TRANSMISSIONS: Transmission[] = [
  "Automatic",
  "Manual",
  "CVT",
  "DCT",
];

export const CONDITIONS: Condition[] = ["New", "Used", "Certified Pre-Owned"];

export const VEHICLE_STATUSES = [
  "available",
  "pre_order",
  "reserved",
  "sold",
] as const;

export const VEHICLE_STATUS_LABELS: Record<string, string> = {
  available: "Available",
  pre_order: "Pre-Order",
  reserved: "Reserved",
  sold: "Sold",
};

export const LOCATIONS = [...locations];

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildVehicleSlug(input: Pick<VehicleInput, "year" | "make" | "model" | "trim">) {
  const parts = [
    String(input.year),
    slugify(input.make),
    slugify(input.model),
    slugify(input.trim || "base"),
    String(Date.now()).slice(-6),
  ];
  return parts.join("-");
}

export function emptyVehicleForm(): VehicleInput {
  return {
    make: "",
    model: "",
    year: new Date().getFullYear(),
    trim: "",
    price: 0,
    mileage: 0,
    fuel_type: "Petrol",
    transmission: "Automatic",
    condition: "Used",
    body_type: "SUV",
    location: LOCATIONS[0],
    engine_size: "",
    color: "",
    vin: "",
    description: "",
    featured: false,
    status: "available",
    images: [],
    gallery: { ...EMPTY_VEHICLE_GALLERY },
  };
}

export function galleryFromInput(
  gallery?: VehicleGalleryData,
  images?: string[]
): VehicleGalleryData {
  return galleryForVehicle({ gallery, images });
}

export function imagesFromGallery(gallery: VehicleGalleryData): string[] {
  return flattenGallery(gallery);
}

export function parseImagesInput(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function imagesToInput(images?: string[]): string {
  return (images ?? []).join("\n");
}
