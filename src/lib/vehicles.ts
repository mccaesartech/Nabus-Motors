import { CHINESE_MAKES } from "@/lib/data/generate-inventory";
import { inferVehicleOrigin } from "@/lib/vehicle-preferences";
import type { CountryOfOrigin, SortOption, Vehicle, VehicleFilters } from "@/lib/types";

function vehicleOrigin(vehicle: Vehicle): CountryOfOrigin {
  if (vehicle.countryOfOrigin) return vehicle.countryOfOrigin;
  return inferVehicleOrigin(vehicle);
}

export function filterVehicles(
  allVehicles: Vehicle[],
  filters: VehicleFilters
): Vehicle[] {
  return allVehicles.filter((vehicle) => {
    if (filters.make && vehicle.make !== filters.make) return false;
    if (filters.model && vehicle.model !== filters.model) return false;
    if (filters.yearMin && vehicle.year < filters.yearMin) return false;
    if (filters.yearMax && vehicle.year > filters.yearMax) return false;
    if (filters.priceMin && vehicle.price < filters.priceMin) return false;
    if (filters.priceMax && vehicle.price > filters.priceMax) return false;
    if (filters.transmission && vehicle.transmission !== filters.transmission)
      return false;
    if (filters.fuelType && vehicle.fuelType !== filters.fuelType) return false;
    if (filters.condition && vehicle.condition !== filters.condition) return false;
    if (filters.bodyType && vehicle.bodyType !== filters.bodyType) return false;
    if (
      filters.chineseBrands &&
      !CHINESE_MAKES.includes(vehicle.make as (typeof CHINESE_MAKES)[number])
    ) {
      return false;
    }
    if (filters.countryOfOrigin && vehicleOrigin(vehicle) !== filters.countryOfOrigin) {
      return false;
    }
    if (filters.financingAvailable && !vehicle.financingAvailable) return false;
    if (filters.shipmentAvailable && !vehicle.shipmentAvailable) return false;
    if (filters.customsClearingAvailable && !vehicle.customsClearingAvailable) {
      return false;
    }
    if (filters.location && vehicle.location !== filters.location) return false;
    if (filters.mileageMax && vehicle.mileage > filters.mileageMax) return false;
    if (filters.status) {
      const vehicleStatus = vehicle.status ?? "available";
      if (vehicleStatus !== filters.status) return false;
    }
    return true;
  });
}

export function sortVehicles(
  vehicleList: Vehicle[],
  sort: SortOption
): Vehicle[] {
  const sorted = [...vehicleList];
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price);
    case "year-desc":
      return sorted.sort((a, b) => b.year - a.year);
    case "year-asc":
      return sorted.sort((a, b) => a.year - b.year);
    case "mileage-asc":
      return sorted.sort((a, b) => a.mileage - b.mileage);
    case "newest":
      return sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case "most-popular":
      return sorted.sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    default:
      return sorted;
  }
}

export function parseFiltersFromSearchParams(
  params: Record<string, string | string[] | undefined>
): VehicleFilters {
  const get = (key: string) => {
    const val = params[key];
    return typeof val === "string" ? val : undefined;
  };

  return {
    make: get("make"),
    model: get("model"),
    yearMin: get("yearMin") ? Number(get("yearMin")) : undefined,
    yearMax: get("yearMax") ? Number(get("yearMax")) : undefined,
    priceMin: get("priceMin") ? Number(get("priceMin")) : undefined,
    priceMax: get("priceMax") ? Number(get("priceMax")) : undefined,
    transmission: get("transmission") as VehicleFilters["transmission"],
    fuelType: get("fuelType") as VehicleFilters["fuelType"],
    condition: get("condition") as VehicleFilters["condition"],
    bodyType: get("bodyType") as VehicleFilters["bodyType"],
    chineseBrands: get("chinese") === "1" || get("chineseBrands") === "1",
    countryOfOrigin: get("countryOfOrigin") as VehicleFilters["countryOfOrigin"],
    financingAvailable: get("financing") === "1" ? true : undefined,
    shipmentAvailable: get("shipment") === "1" ? true : undefined,
    customsClearingAvailable: get("customs") === "1" ? true : undefined,
    location: get("location"),
    mileageMax: get("mileageMax") ? Number(get("mileageMax")) : undefined,
    status: get("status") as VehicleFilters["status"],
  };
}

export function buildFilterSearchParams(
  filters: VehicleFilters,
  sort?: SortOption,
  page?: number
): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });
  if (sort) params.set("sort", sort);
  if (page && page > 1) params.set("page", String(page));
  return params;
}
