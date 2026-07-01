import { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS } from "./vehicle-fields";

/** Chinese brand list — keep in sync with generate-inventory.ts */
export const CHINESE_MAKES = [
  "BYD",
  "Geely",
  "Chery",
  "MG",
  "Haval",
  "Changan",
  "GWM",
  "Jetour",
  "DFSK",
  "BAIC",
  "Lynk & Co",
  "XPeng",
  "NIO",
  "Hongqi",
  "Zeekr",
  "Li Auto",
  "Aion",
  "Wuling",
  "Voyah",
  "Denza",
] as const;

export type InventoryFilters = {
  bodyType: string;
  transmission: string;
  fuelType: string;
  brandOrigin: "all" | "chinese" | "international";
  status: string;
  featured: "all" | "yes" | "no";
};

export const EMPTY_INVENTORY_FILTERS: InventoryFilters = {
  bodyType: "all",
  transmission: "all",
  fuelType: "all",
  brandOrigin: "all",
  status: "all",
  featured: "all",
};

export type VehicleLike = {
  make: string;
  body_type: string;
  transmission: string;
  fuel_type: string;
  status: string;
  featured: boolean;
  year: number;
  model: string;
  location?: string;
  slug?: string;
  vin?: string | null;
};

export function isChineseMake(make: string): boolean {
  return CHINESE_MAKES.includes(make as (typeof CHINESE_MAKES)[number]);
}

/** Primary body type plus up to two secondary merchandising tags (max 3 total). */
export function vehicleCategories(v: VehicleLike, limit = 3): string[] {
  const tags: string[] = [v.body_type];
  const secondary: string[] = [];

  if (v.featured) secondary.push("Featured");
  if (isChineseMake(v.make)) secondary.push("Chinese");
  if (v.fuel_type === "Electric" || v.body_type === "Electric") secondary.push("Electric");
  if (v.fuel_type === "Hybrid" || v.fuel_type === "Plug-in Hybrid") secondary.push(v.fuel_type);
  if (v.transmission === "Manual") secondary.push("Manual");

  for (const tag of secondary) {
    if (tags.length >= limit) break;
    if (!tags.includes(tag)) tags.push(tag);
  }

  return tags.slice(0, limit);
}

export function applyInventoryFilters<T extends VehicleLike>(
  vehicles: T[],
  filters: InventoryFilters,
  search: string
): T[] {
  const q = search.trim().toLowerCase();

  return vehicles.filter((v) => {
    if (filters.bodyType !== "all" && v.body_type !== filters.bodyType) return false;
    if (filters.transmission !== "all" && v.transmission !== filters.transmission)
      return false;
    if (filters.fuelType !== "all" && v.fuel_type !== filters.fuelType) return false;
    if (filters.status !== "all" && v.status !== filters.status) return false;
    if (filters.featured === "yes" && !v.featured) return false;
    if (filters.featured === "no" && v.featured) return false;
    if (filters.brandOrigin === "chinese" && !isChineseMake(v.make)) return false;
    if (filters.brandOrigin === "international" && isChineseMake(v.make)) return false;

    if (q) {
      const haystack =
        `${v.year} ${v.make} ${v.model} ${v.slug ?? ""} ${v.vin ?? ""} ${v.body_type} ${v.transmission} ${v.fuel_type} ${v.status} ${v.location ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

export type FilterChip = {
  id: string;
  label: string;
  count: number;
  filters: Partial<InventoryFilters>;
};

export function buildFilterChips(vehicles: VehicleLike[]): FilterChip[] {
  const count = (fn: (v: VehicleLike) => boolean) => vehicles.filter(fn).length;

  return [
    { id: "all", label: "All", count: vehicles.length, filters: EMPTY_INVENTORY_FILTERS },
    {
      id: "suv",
      label: "SUVs",
      count: count((v) => v.body_type === "SUV"),
      filters: { bodyType: "SUV" },
    },
    {
      id: "sedan",
      label: "Sedans",
      count: count((v) => v.body_type === "Sedan"),
      filters: { bodyType: "Sedan" },
    },
    {
      id: "luxury",
      label: "Luxury",
      count: count((v) => v.body_type === "Luxury"),
      filters: { bodyType: "Luxury" },
    },
    {
      id: "truck",
      label: "Trucks",
      count: count((v) => v.body_type === "Truck"),
      filters: { bodyType: "Truck" },
    },
    {
      id: "electric",
      label: "Electric",
      count: count(
        (v) => v.fuel_type === "Electric" || v.body_type === "Electric"
      ),
      filters: { fuelType: "Electric" },
    },
    {
      id: "chinese",
      label: "Chinese brands",
      count: count((v) => isChineseMake(v.make)),
      filters: { brandOrigin: "chinese" },
    },
    {
      id: "international",
      label: "International",
      count: count((v) => !isChineseMake(v.make)),
      filters: { brandOrigin: "international" },
    },
    {
      id: "manual",
      label: "Manual",
      count: count((v) => v.transmission === "Manual"),
      filters: { transmission: "Manual" },
    },
    {
      id: "automatic",
      label: "Automatic",
      count: count((v) => v.transmission === "Automatic"),
      filters: { transmission: "Automatic" },
    },
    {
      id: "available",
      label: "Available",
      count: count((v) => v.status === "available"),
      filters: { status: "available" },
    },
    {
      id: "pre_order",
      label: "Pre-order",
      count: count((v) => v.status === "pre_order"),
      filters: { status: "pre_order" },
    },
    {
      id: "sold",
      label: "Sold",
      count: count((v) => v.status === "sold"),
      filters: { status: "sold" },
    },
    {
      id: "featured",
      label: "Featured",
      count: count((v) => v.featured),
      filters: { featured: "yes" },
    },
  ];
}

export { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS };
