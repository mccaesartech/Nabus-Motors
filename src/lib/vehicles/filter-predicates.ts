import { isChineseMake } from "@/lib/vehicles/chinese-makes";
import { inferVehicleOrigin } from "@/lib/vehicle-preferences";
import type { CountryOfOrigin, Vehicle, VehicleFilters } from "@/lib/types";
import type { TrustBadgeKey } from "@/lib/vehicles/trust-badges";
import {
  matchesFulfillmentMode,
  resolveFulfillmentMode,
} from "@/lib/vehicles/fulfillment";
import { isLocallyAvailableForBanner } from "@/lib/vehicles/local-availability";
import { vehicleMatchesKeyword } from "@/lib/vehicles/keyword-search";

function vehicleOrigin(vehicle: Vehicle): CountryOfOrigin {
  if (vehicle.countryOfOrigin) return vehicle.countryOfOrigin;
  return inferVehicleOrigin(vehicle);
}

function caseInsensitiveEq(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export type FilterPredicate = (vehicle: Vehicle, filters: VehicleFilters) => boolean;

export const FILTER_PREDICATES: Record<string, FilterPredicate> = {
  q: (v, f) => vehicleMatchesKeyword(v, f.q),
  make: (v, f) => !f.make || caseInsensitiveEq(v.make, f.make),
  model: (v, f) => !f.model || caseInsensitiveEq(v.model, f.model),
  yearMin: (v, f) => !f.yearMin || v.year >= f.yearMin,
  yearMax: (v, f) => !f.yearMax || v.year <= f.yearMax,
  priceMin: (v, f) => !f.priceMin || v.price >= f.priceMin,
  priceMax: (v, f) => !f.priceMax || v.price <= f.priceMax,
  transmission: (v, f) => !f.transmission || v.transmission === f.transmission,
  fuelType: (v, f) => !f.fuelType || v.fuelType === f.fuelType,
  condition: (v, f) => !f.condition || v.condition === f.condition,
  bodyType: (v, f) => !f.bodyType || v.bodyType === f.bodyType,
  location: (v, f) => !f.location || v.location === f.location,
  mileageMax: (v, f) => !f.mileageMax || v.mileage <= f.mileageMax,
  chineseBrands: (v, f) => !f.chineseBrands || isChineseMake(v.make),
  countryOfOrigin: (v, f) =>
    !f.countryOfOrigin || vehicleOrigin(v) === f.countryOfOrigin,
  financingAvailable: (v, f) =>
    !f.financingAvailable || Boolean(v.financingAvailable),
  customsClearingAvailable: (v, f) =>
    !f.customsClearingAvailable || Boolean(v.customsClearingAvailable),
  trustBadges: (v, f) => {
    if (!f.trustBadges?.length) return true;
    const badges = v.trustBadges;
    if (!badges) return false;
    return f.trustBadges.every((key) => badges[key as TrustBadgeKey]);
  },
  fulfillment: (v, f) => {
    const mode = resolveFulfillmentMode(f);
    return matchesFulfillmentMode(v, mode);
  },
  status: (v, f) => {
    const mode = resolveFulfillmentMode(f);
    if (mode !== "all") return true;
    if (!f.status) return true;
    return (v.status ?? "available") === f.status;
  },
  availableLocally: (v, f) => {
    const mode = resolveFulfillmentMode(f);
    if (mode !== "all") return true;
    if (!f.availableLocally) return true;
    return isLocallyAvailableForBanner(v);
  },
  shipmentAvailable: (v, f) => {
    const mode = resolveFulfillmentMode(f);
    if (mode !== "all") return true;
    if (!f.shipmentAvailable) return true;
    return Boolean(v.shipmentAvailable);
  },
};

const PREDICATE_ORDER: (keyof typeof FILTER_PREDICATES)[] = [
  "q",
  "make",
  "model",
  "yearMin",
  "yearMax",
  "priceMin",
  "priceMax",
  "transmission",
  "fuelType",
  "condition",
  "bodyType",
  "location",
  "mileageMax",
  "chineseBrands",
  "countryOfOrigin",
  "financingAvailable",
  "customsClearingAvailable",
  "trustBadges",
  "fulfillment",
  "status",
  "availableLocally",
  "shipmentAvailable",
];

export function vehicleMatchesFilters(
  vehicle: Vehicle,
  filters: VehicleFilters
): boolean {
  for (const key of PREDICATE_ORDER) {
    if (!FILTER_PREDICATES[key](vehicle, filters)) return false;
  }
  return true;
}
