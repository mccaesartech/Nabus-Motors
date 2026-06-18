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

export interface VehicleSpec {
  label: string;
  value: string;
}

export interface HistoryEvent {
  date: string;
  title: string;
  description: string;
}

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
  specs: VehicleSpec[];
  history: HistoryEvent[];
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
}

export type SortOption =
  | "price-asc"
  | "price-desc"
  | "year-desc"
  | "year-asc"
  | "mileage-asc"
  | "newest";

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
