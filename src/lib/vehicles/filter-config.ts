import { BODY_TYPES } from "@/lib/admin/vehicle-fields";
import { TRUST_BADGE_KEYS, TRUST_BADGE_LABELS } from "@/lib/vehicles/trust-badges";
import type { TrustBadgeKey } from "@/lib/vehicles/trust-badges";
import type {
  BodyType,
  Condition,
  FuelType,
  FulfillmentMode,
  Transmission,
  VehicleAvailabilityStatus,
  VehicleFilters,
} from "@/lib/types";

export const FULFILLMENT_MODES: { value: FulfillmentMode; label: string }[] = [
  { value: "all", label: "All fulfillment options" },
  { value: "in_ghana", label: "In Ghana now" },
  { value: "import_ship", label: "Import / ship to Ghana" },
  { value: "pre_order_only", label: "Pre-order only" },
];

/** Mutually exclusive fulfillment fields — only one mode may be active. */
export const FULFILLMENT_EXCLUSIVE_KEYS: (keyof VehicleFilters)[] = [
  "fulfillmentMode",
  "availableLocally",
  "shipmentAvailable",
  "status",
];

export const BODY_TYPE_OPTIONS = BODY_TYPES;

export const FUEL_TYPE_OPTIONS: FuelType[] = [
  "Petrol",
  "Diesel",
  "Hybrid",
  "Electric",
  "Plug-in Hybrid",
];

export const TRANSMISSION_OPTIONS: Transmission[] = [
  "Automatic",
  "Manual",
  "CVT",
  "DCT",
];

export const CONDITION_OPTIONS: Condition[] = [
  "New",
  "Used",
  "Certified Pre-Owned",
];

export const STATUS_FILTER_OPTIONS: {
  value: VehicleAvailabilityStatus;
  label: string;
}[] = [
  { value: "available", label: "Buy now" },
  { value: "pre_order", label: "Pre-Order" },
];

/** Mileage tiers stored in miles (matches formatMileage). */
export const MILEAGE_FILTER_TIERS = [15000, 30000, 50000, 75000, 100000] as const;

export const MILEAGE_UNIT = "mi" as const;

export const TRUST_BADGE_FILTER_OPTIONS = TRUST_BADGE_KEYS.map((key) => ({
  key,
  label: TRUST_BADGE_LABELS[key],
}));

export const VALID_BODY_TYPES = new Set<string>(BODY_TYPES);
export const VALID_FUEL_TYPES = new Set<string>(FUEL_TYPE_OPTIONS);
export const VALID_TRANSMISSIONS = new Set<string>(TRANSMISSION_OPTIONS);
export const VALID_CONDITIONS = new Set<string>(CONDITION_OPTIONS);
export const VALID_STATUSES = new Set<string>([
  "available",
  "pre_order",
  "reserved",
  "sold",
]);
export const VALID_TRUST_BADGES = new Set<string>(TRUST_BADGE_KEYS);

export function isValidBodyType(value: string): value is BodyType {
  return VALID_BODY_TYPES.has(value);
}

export function isValidTrustBadge(value: string): value is TrustBadgeKey {
  return VALID_TRUST_BADGES.has(value);
}

/** Apply fulfillment exclusivity when a mode is selected. */
export function applyFulfillmentExclusivity(
  filters: VehicleFilters,
  mode: FulfillmentMode
): VehicleFilters {
  const next: VehicleFilters = {
    ...filters,
    fulfillmentMode: mode === "all" ? undefined : mode,
    availableLocally: undefined,
    shipmentAvailable: undefined,
    status: undefined,
  };

  switch (mode) {
    case "in_ghana":
      next.availableLocally = true;
      break;
    case "import_ship":
      next.shipmentAvailable = true;
      break;
    case "pre_order_only":
      next.status = "pre_order";
      break;
    case "all":
    default:
      break;
  }

  return next;
}

/** Count active non-default filters for chip display and recommendations. */
export function countActiveFilters(filters: VehicleFilters): number {
  let count = 0;
  if (filters.q) count++;
  if (filters.make) count++;
  if (filters.model) count++;
  if (filters.yearMin || filters.yearMax) count++;
  if (filters.priceMin || filters.priceMax) count++;
  if (filters.transmission) count++;
  if (filters.fuelType) count++;
  if (filters.condition) count++;
  if (filters.bodyType) count++;
  if (filters.location) count++;
  if (filters.mileageMax) count++;
  if (filters.chineseBrands) count++;
  if (filters.countryOfOrigin) count++;
  if (filters.financingAvailable) count++;
  if (filters.customsClearingAvailable) count++;
  if (filters.trustBadges?.length) count++;
  if (filters.fulfillmentMode && filters.fulfillmentMode !== "all") count++;
  else {
    if (filters.availableLocally) count++;
    if (filters.shipmentAvailable) count++;
    if (filters.status) count++;
  }
  return count;
}

export function hasActiveInventoryFilters(filters: VehicleFilters): boolean {
  return countActiveFilters(filters) > 0;
}
