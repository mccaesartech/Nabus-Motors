import type { CartVehicleLine } from "@/lib/parts/cart-types";
import type { CartVehicleCatalogState } from "@/lib/parts/cart-types";
import type { Vehicle } from "@/lib/types";
import { buildVehicleIdentifierMap } from "@/lib/vehicles/identifier-map";

/** Collect UUID/slug keys for lookup — includes snapshot slugs for legacy cart IDs. */
export function collectCartVehicleLookupKeys(items: CartVehicleLine[]): string[] {
  const keys = new Set<string>();
  for (const item of items) {
    if (item.vehicleId) keys.add(item.vehicleId.trim());
    if (item.snapshot?.slug) keys.add(item.snapshot.slug.trim());
  }
  return [...keys];
}

/** Match a cart line to a vehicle returned from lookup (by stored id or snapshot slug). */
export function matchCartVehicleToLookup(
  item: CartVehicleLine,
  vehicleMap: Map<string, Vehicle>
): Vehicle | undefined {
  return (
    vehicleMap.get(item.vehicleId) ??
    (item.snapshot?.slug ? vehicleMap.get(item.snapshot.slug) : undefined)
  );
}

export function buildLookupVehicleMap(vehicles: Vehicle[]): Map<string, Vehicle> {
  return buildVehicleIdentifierMap(vehicles);
}

export type CartVehicleDisplayState =
  | "available"
  | "preorder"
  | "listing_pending"
  | "not_in_catalog"
  | "checking"
  | "unknown";

export function resolveCartVehicleDisplayState(input: {
  lookupDone: boolean;
  lookupConfirmed: boolean;
  unresolvedReason?: "not_found" | "listing_pending" | "not_public";
  status: string | null;
  intent: "buy" | "pre_order";
  catalog?: CartVehicleCatalogState;
}): CartVehicleDisplayState {
  if (!input.lookupDone) return "checking";
  if (!input.lookupConfirmed) {
    if (input.unresolvedReason === "listing_pending") return "listing_pending";
    if (input.unresolvedReason === "not_public") return "preorder";
    return "not_in_catalog";
  }

  if (input.catalog?.listingPending) return "listing_pending";
  if (input.catalog && !input.catalog.publiclyListed) {
    return input.catalog.approvalStatus === "rejected"
      ? "not_in_catalog"
      : "preorder";
  }

  if (input.status === "sold") return "not_in_catalog";
  if (input.status === "pre_order" || input.intent === "pre_order") return "preorder";
  if (input.status === "available") return "available";
  if (input.status === "reserved") return "preorder";
  return "preorder";
}

export function vehicleAvailabilityBadgeLabel(state: CartVehicleDisplayState): string {
  switch (state) {
    case "checking":
      return "Checking…";
    case "available":
      return "Available";
    case "preorder":
      return "Pre-order only";
    case "listing_pending":
      return "Listing pending";
    case "not_in_catalog":
      return "Not in catalog";
    default:
      return "Checking…";
  }
}
