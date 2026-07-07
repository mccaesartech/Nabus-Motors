import type { VehicleTrustBadges, TrustBadgeKey } from "@/lib/vehicles/trust-badges";

export type BodyType =
  | "SUV"
  | "Sedan"
  | "Luxury"
  | "Truck"
  | "Commercial"
  | "Electric"
  | "Coupe"
  | "Hatchback";

export type FuelType = "Petrol" | "Diesel" | "Hybrid" | "Electric" | "Plug-in Hybrid";

export type Transmission = "Automatic" | "Manual" | "CVT" | "DCT";

export type Condition = "New" | "Used" | "Certified Pre-Owned";

export type CountryOfOrigin = "china" | "japan" | "ghana" | "other";

export type { VehicleTrustBadges, TrustBadgeKey };

export type VehicleAvailabilityStatus =
  | "available"
  | "pre_order"
  | "reserved"
  | "sold";

export interface VehicleSpec {
  label: string;
  value: string;
}

export interface HistoryEvent {
  date: string;
  title: string;
  description: string;
}

export type VehicleImageCategory = "exterior" | "interior" | "engine" | "other";

export interface VehicleGalleryData {
  exterior: string[];
  interior: string[];
  engine: string[];
  other: string[];
}

export const EMPTY_VEHICLE_GALLERY: VehicleGalleryData = {
  exterior: [],
  interior: [],
  engine: [],
  other: [],
};

export const VEHICLE_GALLERY_ORDER: VehicleImageCategory[] = [
  "exterior",
  "interior",
  "engine",
  "other",
];

export interface Vehicle {
  id: string;
  slug: string;
  make: string;
  model: string;
  year: number;
  trim?: string;
  price: number;
  mileage: number;
  fuelType: FuelType;
  transmission: Transmission;
  condition: Condition;
  bodyType: BodyType;
  location: string;
  engineSize: string;
  color: string;
  vin: string;
  description: string;
  featured: boolean;
  images: string[];
  primaryImageUrl?: string;
  additionalImages?: string[];
  gallery?: VehicleGalleryData;
  specs: VehicleSpec[];
  history: HistoryEvent[];
  status?: VehicleAvailabilityStatus;
  trustBadges?: VehicleTrustBadges;
  inspectionSummary?: string | null;
  countryOfOrigin?: CountryOfOrigin | null;
  financingAvailable?: boolean;
  shipmentAvailable?: boolean;
  customsClearingAvailable?: boolean;
  warrantyNotes?: string | null;
  walkaroundVideoUrl?: string | null;
  availableLocally?: boolean;
  createdAt: string;
}

export interface VehicleFilters {
  make?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  transmission?: Transmission;
  fuelType?: FuelType;
  condition?: Condition;
  bodyType?: BodyType;
  location?: string;
  mileageMax?: number;
  chineseBrands?: boolean;
  countryOfOrigin?: "china" | "japan";
  financingAvailable?: boolean;
  shipmentAvailable?: boolean;
  customsClearingAvailable?: boolean;
  status?: VehicleAvailabilityStatus;
}

export type SortOption =
  | "price-asc"
  | "price-desc"
  | "year-desc"
  | "year-asc"
  | "mileage-asc"
  | "newest"
  | "most-popular";

export interface Testimonial {
  id: string;
  name: string;
  location: string;
  vehicle: string;
  rating: number;
  quote: string;
  image: string;
  verified: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: BodyType;
  count: number;
  image: string;
  href?: string;
}

export interface SavedVehicle extends Vehicle {
  savedAt: string;
  previousPrice?: number;
}
