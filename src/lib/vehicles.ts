import type { SortOption, Vehicle, VehicleFilters } from "@/lib/types";
import { vehicleMatchesFilters } from "@/lib/vehicles/filter-predicates";

export {
  buildFilterSearchParams,
  parseFiltersFromSearchParams,
  parsePageFromSearchParams,
  parseSortFromSearchParams,
} from "@/lib/vehicles/filter-params";

export function filterVehicles(
  allVehicles: Vehicle[],
  filters: VehicleFilters
): Vehicle[] {
  return allVehicles.filter((vehicle) => vehicleMatchesFilters(vehicle, filters));
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
