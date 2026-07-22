import type { FulfillmentMode, SortOption, VehicleFilters } from "@/lib/types";
import type { TrustBadgeKey } from "@/lib/vehicles/trust-badges";
import {
  applyFulfillmentExclusivity,
  isValidBodyType,
  isValidTrustBadge,
  VALID_CONDITIONS,
  VALID_FUEL_TYPES,
  VALID_STATUSES,
  VALID_TRANSMISSIONS,
} from "@/lib/vehicles/filter-config";
import { resolveFulfillmentMode } from "@/lib/vehicles/fulfillment";

const VALID_FULFILLMENT_MODES = new Set<FulfillmentMode>([
  "all",
  "in_ghana",
  "import_ship",
  "pre_order_only",
]);

const VALID_SORT_OPTIONS = new Set<string>([
  "price-asc",
  "price-desc",
  "year-desc",
  "year-asc",
  "mileage-asc",
  "newest",
  "most-popular",
]);

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const val = params[key];
  return typeof val === "string" ? val : undefined;
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return undefined;
  return n;
}

function parseFulfillmentMode(value: string | undefined): FulfillmentMode | undefined {
  if (!value) return undefined;
  if (VALID_FULFILLMENT_MODES.has(value as FulfillmentMode)) {
    return value as FulfillmentMode;
  }
  if (value === "import") return "import_ship";
  if (value === "pre_order") return "pre_order_only";
  return undefined;
}

function parseTrustBadges(raw: string | undefined): TrustBadgeKey[] | undefined {
  if (!raw) return undefined;
  const keys = raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => isValidTrustBadge(k));
  return keys.length ? keys : undefined;
}

export function parseFiltersFromSearchParams(
  params: Record<string, string | string[] | undefined>
): VehicleFilters {
  const fulfillmentFromParam = parseFulfillmentMode(getParam(params, "fulfillment"));
  const legacyLocal = getParam(params, "available_locally") === "1";
  const legacyShipment = getParam(params, "shipment") === "1";
  const legacyStatus = getParam(params, "status");

  let fulfillmentMode = fulfillmentFromParam;
  if (!fulfillmentMode) {
    if (legacyStatus === "pre_order") fulfillmentMode = "pre_order_only";
    else if (legacyLocal) fulfillmentMode = "in_ghana";
    else if (legacyShipment) fulfillmentMode = "import_ship";
  }

  const transmission = getParam(params, "transmission");
  const fuelType = getParam(params, "fuelType");
  const condition = getParam(params, "condition");
  const bodyType = getParam(params, "bodyType");
  const status = getParam(params, "status");

  const filters: VehicleFilters = {
    make: getParam(params, "make")?.slice(0, 80),
    model: getParam(params, "model")?.slice(0, 80),
    yearMin: parsePositiveInt(getParam(params, "yearMin")),
    yearMax: parsePositiveInt(getParam(params, "yearMax")),
    priceMin: parsePositiveInt(getParam(params, "priceMin")),
    priceMax: parsePositiveInt(getParam(params, "priceMax")),
    transmission:
      transmission && VALID_TRANSMISSIONS.has(transmission)
        ? (transmission as VehicleFilters["transmission"])
        : undefined,
    fuelType:
      fuelType && VALID_FUEL_TYPES.has(fuelType)
        ? (fuelType as VehicleFilters["fuelType"])
        : undefined,
    condition:
      condition && VALID_CONDITIONS.has(condition)
        ? (condition as VehicleFilters["condition"])
        : undefined,
    bodyType:
      bodyType && isValidBodyType(bodyType)
        ? bodyType
        : undefined,
    chineseBrands:
      getParam(params, "chinese") === "1" || getParam(params, "chineseBrands") === "1"
        ? true
        : undefined,
    countryOfOrigin: (() => {
      const origin = getParam(params, "countryOfOrigin");
      return origin === "china" || origin === "japan" ? origin : undefined;
    })(),
    financingAvailable: getParam(params, "financing") === "1" ? true : undefined,
    customsClearingAvailable: getParam(params, "customs") === "1" ? true : undefined,
    location: getParam(params, "location")?.slice(0, 120),
    mileageMax: parsePositiveInt(getParam(params, "mileageMax")),
    trustBadges: parseTrustBadges(getParam(params, "trust")),
    fulfillmentMode,
  };

  if (fulfillmentMode && fulfillmentMode !== "all") {
    return applyFulfillmentExclusivity(filters, fulfillmentMode);
  }

  if (status && VALID_STATUSES.has(status)) {
    filters.status = status as VehicleFilters["status"];
  }

  return filters;
}

const BOOLEAN_FILTER_PARAM_KEYS: Partial<Record<keyof VehicleFilters, string>> = {
  chineseBrands: "chinese",
  financingAvailable: "financing",
  customsClearingAvailable: "customs",
};

const FULFILLMENT_PARAM_MAP: Partial<Record<FulfillmentMode, string>> = {
  in_ghana: "in_ghana",
  import_ship: "import_ship",
  pre_order_only: "pre_order_only",
};

export function buildFilterSearchParams(
  filters: VehicleFilters,
  sort?: SortOption,
  page?: number
): URLSearchParams {
  const params = new URLSearchParams();
  const mode = resolveFulfillmentMode(filters);

  if (mode !== "all") {
    const fulfillmentParam = FULFILLMENT_PARAM_MAP[mode];
    if (fulfillmentParam) params.set("fulfillment", fulfillmentParam);
  }

  const skipKeys = new Set<keyof VehicleFilters>([
    "fulfillmentMode",
    "availableLocally",
    "shipmentAvailable",
    "status",
  ]);

  Object.entries(filters).forEach(([key, value]) => {
    const filterKey = key as keyof VehicleFilters;
    if (skipKeys.has(filterKey)) return;
    if (value === undefined || value === "") return;

    const shortKey = BOOLEAN_FILTER_PARAM_KEYS[filterKey];
    if (shortKey) {
      if (value === true) params.set(shortKey, "1");
      return;
    }

    if (filterKey === "trustBadges" && Array.isArray(value)) {
      if (value.length) params.set("trust", value.join(","));
      return;
    }

    params.set(key, String(value));
  });

  if (sort && VALID_SORT_OPTIONS.has(sort)) params.set("sort", sort);
  if (page && page > 1) params.set("page", String(page));
  return params;
}

export function parseSortFromSearchParams(
  params: Record<string, string | string[] | undefined>
): SortOption {
  const sort = getParam(params, "sort");
  if (sort && VALID_SORT_OPTIONS.has(sort)) return sort as SortOption;
  return "newest";
}

export function parsePageFromSearchParams(
  params: Record<string, string | string[] | undefined>
): number {
  const page = parsePositiveInt(getParam(params, "page"));
  return page && page > 0 ? page : 1;
}
