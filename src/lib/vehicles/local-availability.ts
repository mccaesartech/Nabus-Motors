import type { Vehicle } from "@/lib/types";

type LocalAvailabilityVehicle = Pick<
  Vehicle,
  "status" | "availableLocally" | "countryOfOrigin"
> & {
  location?: string;
};

/** Vehicle is physically located in Ghana (location or origin metadata). */
export function isGhanaLocatedVehicle(vehicle: LocalAvailabilityVehicle): boolean {
  if (vehicle.countryOfOrigin === "ghana") return true;
  return vehicle.location?.toLowerCase().includes("ghana") ?? false;
}

/**
 * Vehicles that qualify for the pulsing "in Ghana" banner and
 * `?available_locally=1` inventory view.
 *
 * Includes admin-flagged local arrivals and regular in-stock Ghana inventory.
 */
export function isLocallyAvailableForBanner(vehicle: LocalAvailabilityVehicle): boolean {
  if (vehicle.status === "sold") return false;
  if (vehicle.availableLocally) return true;
  return vehicle.status === "available" && isGhanaLocatedVehicle(vehicle);
}
