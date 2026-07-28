import "server-only";

import type { SortOption, Vehicle, VehicleFilters } from "@/lib/types";
import { CHINESE_MAKES } from "@/lib/vehicles/chinese-makes";
import {
  PUBLIC_LISTING_APPROVAL_OR,
  mapRow,
  type VehicleRow,
} from "@/lib/supabase/vehicles";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { notDeletedFilter } from "@/lib/platform/trash-types";
import { PUBLIC_VEHICLE_STATUSES } from "@/lib/vehicles/availability";
import { resolveFulfillmentMode } from "@/lib/vehicles/fulfillment";
import { filterVehicles, sortVehicles } from "@/lib/vehicles";
import { fetchAllVehicles } from "@/lib/supabase/vehicles";
import { vehicles as mockVehicles } from "@/lib/data/vehicles";
import type { TrustBadgeKey } from "@/lib/vehicles/trust-badges";
import { applyKeywordFilterToQuery } from "@/lib/vehicles/keyword-search";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VehicleQuery = any;

const PUBLIC_LISTING_SELECT =
  "id, slug, make, model, year, trim, price, price_currency, listed_price, mileage, fuel_type, transmission, condition, body_type, location, featured, images, primary_image_url, additional_images, status, trust_badges, country_of_origin, financing_available, shipment_available, customs_clearing_available, available_locally, local_availability_at, created_at";

function applySort(query: VehicleQuery, sort: SortOption): VehicleQuery {
  switch (sort) {
    case "price-asc":
      return query.order("price", { ascending: true });
    case "price-desc":
      return query.order("price", { ascending: false });
    case "year-desc":
      return query.order("year", { ascending: false });
    case "year-asc":
      return query.order("year", { ascending: true });
    case "mileage-asc":
      return query.order("mileage", { ascending: true });
    case "most-popular":
      return query.order("featured", { ascending: false }).order("created_at", {
        ascending: false,
      });
    case "newest":
    default:
      return query.order("created_at", { ascending: false });
  }
}

function applyTrustBadgeFilters(
  query: VehicleQuery,
  badges: TrustBadgeKey[] | undefined
): VehicleQuery {
  let q = query;
  for (const badge of badges ?? []) {
    q = q.contains("trust_badges", { [badge]: true });
  }
  return q;
}

function applyFulfillmentFilter(
  query: VehicleQuery,
  filters: VehicleFilters
): VehicleQuery {
  const mode = resolveFulfillmentMode(filters);
  switch (mode) {
    case "in_ghana":
      return query.or(
        "available_locally.eq.true,and(status.eq.available,or(country_of_origin.eq.ghana,location.ilike.%ghana%))"
      );
    case "import_ship":
      return query
        .eq("shipment_available", true)
        .eq("available_locally", false)
        .eq("status", "available")
        .not("country_of_origin", "eq", "ghana")
        .not("location", "ilike", "%ghana%");
    case "pre_order_only":
      return query.eq("status", "pre_order");
    default:
      if (filters.status) return query.eq("status", filters.status);
      return query;
  }
}

export function applyVehicleFiltersToQuery(
  query: VehicleQuery,
  filters: VehicleFilters
): VehicleQuery {
  let q = query;

  // Case-insensitive exact match so catalog casing mismatches still find stock.
  if (filters.make) q = q.ilike("make", filters.make);
  if (filters.model) q = q.ilike("model", filters.model);
  if (filters.yearMin) q = q.gte("year", filters.yearMin);
  if (filters.yearMax) q = q.lte("year", filters.yearMax);
  if (filters.priceMin) q = q.gte("price", filters.priceMin);
  if (filters.priceMax) q = q.lte("price", filters.priceMax);
  if (filters.transmission) q = q.eq("transmission", filters.transmission);
  if (filters.fuelType) q = q.eq("fuel_type", filters.fuelType);
  if (filters.condition) q = q.eq("condition", filters.condition);
  if (filters.bodyType) q = q.eq("body_type", filters.bodyType);
  if (filters.location) q = q.eq("location", filters.location);
  if (filters.mileageMax) q = q.lte("mileage", filters.mileageMax);
  if (filters.chineseBrands) q = q.in("make", [...CHINESE_MAKES]);
  if (filters.countryOfOrigin) q = q.eq("country_of_origin", filters.countryOfOrigin);
  if (filters.financingAvailable) q = q.eq("financing_available", true);
  if (filters.customsClearingAvailable) q = q.eq("customs_clearing_available", true);

  q = applyKeywordFilterToQuery(q, filters.q);
  q = applyFulfillmentFilter(q, filters);
  q = applyTrustBadgeFilters(q, filters.trustBadges);

  return q;
}

export type VehicleQueryResult = {
  vehicles: Vehicle[];
  total: number;
  source: "supabase" | "memory";
};

async function queryFromMemory(
  filters: VehicleFilters,
  sort: SortOption,
  page: number,
  pageSize: number
): Promise<VehicleQueryResult> {
  const publicMock = mockVehicles.filter(
    (v) => !v.status || v.status === "available" || v.status === "pre_order"
  );
  const filtered = sortVehicles(filterVehicles(publicMock, filters), sort);
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  return {
    vehicles: filtered.slice(start, start + pageSize),
    total,
    source: "memory",
  };
}

export async function queryFilteredVehicles(
  filters: VehicleFilters,
  sort: SortOption,
  page: number,
  pageSize: number
): Promise<VehicleQueryResult> {
  const supabase = createServerSupabase();
  if (!supabase) {
    return queryFromMemory(filters, sort, page, pageSize);
  }

  try {
    let base = notDeletedFilter(
      supabase
        .from("vehicles")
        .select(PUBLIC_LISTING_SELECT, { count: "exact" })
        .in("status", PUBLIC_VEHICLE_STATUSES)
        .or(PUBLIC_LISTING_APPROVAL_OR)
    );

    base = applyVehicleFiltersToQuery(base, filters);
    base = applySort(base, sort);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await base.range(from, to);

    if (error) {
      console.error("[vehicle-queries] Supabase filter failed, using memory:", error.message);
      if (isSupabaseConfigured()) {
        const all = await fetchAllVehicles();
        const filtered = sortVehicles(filterVehicles(all, filters), sort);
        const total = filtered.length;
        const start = (page - 1) * pageSize;
        return {
          vehicles: filtered.slice(start, start + pageSize),
          total,
          source: "memory",
        };
      }
      return queryFromMemory(filters, sort, page, pageSize);
    }

    return {
      vehicles: (data ?? []).map((row) => mapRow(row as VehicleRow)),
      total: count ?? 0,
      source: "supabase",
    };
  } catch (err) {
    console.error("[vehicle-queries] query failed:", err);
    return queryFromMemory(filters, sort, page, pageSize);
  }
}

export type VehicleFacetCounts = {
  bodyType: Record<string, number>;
  fuelType: Record<string, number>;
  fulfillment: Record<string, number>;
  total: number;
};

export async function queryVehicleFacetCounts(
  filters: VehicleFilters
): Promise<VehicleFacetCounts> {
  const all = await fetchAllVehicles();
  const filtered = filterVehicles(all, filters);

  const bodyType: Record<string, number> = {};
  const fuelType: Record<string, number> = {};
  const fulfillment: Record<string, number> = {
    in_ghana: 0,
    import_ship: 0,
    pre_order_only: 0,
  };

  for (const vehicle of filtered) {
    bodyType[vehicle.bodyType] = (bodyType[vehicle.bodyType] ?? 0) + 1;
    fuelType[vehicle.fuelType] = (fuelType[vehicle.fuelType] ?? 0) + 1;
  }

  const baseFiltered = filterVehicles(all, {
    ...filters,
    fulfillmentMode: undefined,
    availableLocally: undefined,
    shipmentAvailable: undefined,
    status: undefined,
  });
  for (const vehicle of baseFiltered) {
    if (vehicle.status === "pre_order") fulfillment.pre_order_only++;
    else if (vehicle.shipmentAvailable && !vehicle.availableLocally) {
      fulfillment.import_ship++;
    } else if (vehicle.availableLocally || vehicle.location?.toLowerCase().includes("ghana")) {
      fulfillment.in_ghana++;
    }
  }

  return {
    bodyType,
    fuelType,
    fulfillment,
    total: filtered.length,
  };
}
