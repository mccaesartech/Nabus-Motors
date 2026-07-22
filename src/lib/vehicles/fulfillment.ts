import type { Vehicle, VehicleFilters } from "@/lib/types";
import type { FulfillmentMode } from "@/lib/types";
import { isLocallyAvailableForBanner } from "@/lib/vehicles/local-availability";

type FulfillmentVehicle = Pick<
  Vehicle,
  "status" | "availableLocally" | "countryOfOrigin" | "shipmentAvailable"
> & {
  location?: string;
};

export function resolveFulfillmentMode(filters: VehicleFilters): FulfillmentMode {
  if (filters.fulfillmentMode && filters.fulfillmentMode !== "all") {
    return filters.fulfillmentMode;
  }
  if (filters.status === "pre_order") return "pre_order_only";
  if (filters.availableLocally) return "in_ghana";
  if (filters.shipmentAvailable) return "import_ship";
  return "all";
}

export function matchesImportShipVehicle(vehicle: FulfillmentVehicle): boolean {
  if (vehicle.status === "sold" || vehicle.status === "pre_order") return false;
  if (vehicle.shipmentAvailable === false) return false;
  if (isLocallyAvailableForBanner(vehicle)) return false;
  return true;
}

export function matchesFulfillmentMode(
  vehicle: FulfillmentVehicle,
  mode: FulfillmentMode
): boolean {
  switch (mode) {
    case "in_ghana":
      return isLocallyAvailableForBanner(vehicle);
    case "import_ship":
      return matchesImportShipVehicle(vehicle);
    case "pre_order_only":
      return (vehicle.status ?? "available") === "pre_order";
    case "all":
    default:
      return true;
  }
}
