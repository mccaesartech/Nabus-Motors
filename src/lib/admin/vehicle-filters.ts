import { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS } from "./vehicle-fields";
import { matchesSmartQuery } from "@/lib/admin/search-ranking";
import { CHINESE_MAKES, isChineseMake } from "@/lib/vehicles/chinese-makes";
import {
  matchesFulfillmentMode,
} from "@/lib/vehicles/fulfillment";
import { isLocallyAvailableForBanner } from "@/lib/vehicles/local-availability";
import type { FulfillmentMode } from "@/lib/types";

export { CHINESE_MAKES, isChineseMake };

export type InventoryFilters = {
  bodyType: string;
  transmission: string;
  fuelType: string;
  brandOrigin: "all" | "chinese" | "international";
  status: string;
  featured: "all" | "yes" | "no";
  fulfillmentMode: FulfillmentMode | "all";
  availableLocally: "all" | "yes" | "no";
  financingAvailable: "all" | "yes" | "no";
};

export const EMPTY_INVENTORY_FILTERS: InventoryFilters = {
  bodyType: "all",
  transmission: "all",
  fuelType: "all",
  brandOrigin: "all",
  status: "all",
  featured: "all",
  fulfillmentMode: "all",
  availableLocally: "all",
  financingAvailable: "all",
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
  color?: string | null;
  trim?: string | null;
  available_locally?: boolean;
  shipment_available?: boolean;
  financing_available?: boolean;
  country_of_origin?: string | null;
};

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

function adminVehicleAsFilterVehicle(v: VehicleLike) {
  return {
    status: v.status as "available" | "pre_order" | "reserved" | "sold" | undefined,
    availableLocally: v.available_locally ?? false,
    location: v.location,
    countryOfOrigin: (v.country_of_origin as "china" | "japan" | "ghana" | "other" | null) ?? null,
    shipmentAvailable: v.shipment_available ?? false,
  };
}

export function applyInventoryFilters<T extends VehicleLike>(
  vehicles: T[],
  filters: InventoryFilters,
  search: string
): T[] {
  const q = search.trim().toLowerCase();
  const fulfillmentMode = filters.fulfillmentMode;

  return vehicles.filter((v) => {
    if (filters.bodyType !== "all" && v.body_type !== filters.bodyType) return false;
    if (filters.transmission !== "all" && v.transmission !== filters.transmission)
      return false;
    if (filters.fuelType !== "all" && v.fuel_type !== filters.fuelType) return false;
    if (filters.featured === "yes" && !v.featured) return false;
    if (filters.featured === "no" && v.featured) return false;
    if (filters.brandOrigin === "chinese" && !isChineseMake(v.make)) return false;
    if (filters.brandOrigin === "international" && isChineseMake(v.make)) return false;

    if (fulfillmentMode && fulfillmentMode !== "all") {
      if (!matchesFulfillmentMode(adminVehicleAsFilterVehicle(v), fulfillmentMode)) return false;
    } else if (filters.status !== "all" && v.status !== filters.status) {
      return false;
    }

    if (filters.availableLocally === "yes" && !isLocallyAvailableForBanner(adminVehicleAsFilterVehicle(v))) {
      return false;
    }
    if (filters.availableLocally === "no" && isLocallyAvailableForBanner(adminVehicleAsFilterVehicle(v))) {
      return false;
    }
    if (filters.financingAvailable === "yes" && !v.financing_available) return false;
    if (filters.financingAvailable === "no" && v.financing_available) return false;

    if (q) {
      const haystack = `${v.year} ${v.make} ${v.model} ${v.trim ?? ""} ${v.slug ?? ""} ${v.vin ?? ""} ${v.color ?? ""} ${v.body_type} ${v.transmission} ${v.fuel_type} ${v.status} ${v.location ?? ""}`;
      if (
        !matchesSmartQuery(haystack, search, [
          { value: v.vin, kind: "vin", weight: 1.5 },
          { value: v.slug, kind: "sku", weight: 1.3 },
          { value: v.color, kind: "text" },
          { value: v.year, kind: "year" },
        ])
      ) {
        return false;
      }
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

export function buildFilterChips(
  vehicles: VehicleLike[],
  contextFilters: InventoryFilters = EMPTY_INVENTORY_FILTERS
): FilterChip[] {
  const contextual = applyInventoryFilters(vehicles, contextFilters, "");
  const count = (fn: (v: VehicleLike) => boolean) => contextual.filter(fn).length;

  return [
    { id: "all", label: "All", count: contextual.length, filters: EMPTY_INVENTORY_FILTERS },
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
      id: "in_ghana",
      label: "In Ghana now",
      count: count((v) => isLocallyAvailableForBanner(adminVehicleAsFilterVehicle(v))),
      filters: { fulfillmentMode: "in_ghana", status: "all" },
    },
    {
      id: "import_ship",
      label: "Import / ship",
      count: count((v) =>
        matchesFulfillmentMode(adminVehicleAsFilterVehicle(v), "import_ship")
      ),
      filters: { fulfillmentMode: "import_ship", status: "all" },
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
      label: "Buy now",
      count: count((v) => v.status === "available"),
      filters: { status: "available", fulfillmentMode: "all" },
    },
    {
      id: "pre_order",
      label: "Pre-order",
      count: count((v) => v.status === "pre_order"),
      filters: { fulfillmentMode: "pre_order_only", status: "all" },
    },
    {
      id: "sold",
      label: "Sold",
      count: count((v) => v.status === "sold"),
      filters: { status: "sold", fulfillmentMode: "all" },
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
