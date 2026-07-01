export const VEHICLE_AVAILABILITY_STATUSES = [
  "available",
  "pre_order",
  "reserved",
  "sold",
] as const;

export type VehicleAvailabilityStatus =
  (typeof VEHICLE_AVAILABILITY_STATUSES)[number];

export const PUBLIC_VEHICLE_STATUSES: VehicleAvailabilityStatus[] = [
  "available",
  "pre_order",
];

export const PREORDER_DOWN_PAYMENT_RATE = 0.25;

export function isPreOrderStatus(status?: string | null): boolean {
  return status === "pre_order";
}

/** True for available, pre_order, reserved, and unset status; false only for sold. */
export function canPreorder(status?: string | null): boolean {
  return status !== "sold";
}

/** Inventory still on the lot (excludes sold). */
export function isInStockStatus(status?: string | null): boolean {
  return canPreorder(status);
}

export function isPublicVehicleStatus(status?: string | null): boolean {
  return status === "available" || status === "pre_order";
}

export function availabilityLabel(status?: string | null): string {
  switch (status) {
    case "pre_order":
      return "Pre-Order";
    case "sold":
      return "Sold";
    case "reserved":
      return "Reserved";
    default:
      return "Available";
  }
}

export function downPaymentUsd(priceUsd: number): number {
  return Math.round(priceUsd * PREORDER_DOWN_PAYMENT_RATE);
}

/** Vehicle can be purchased immediately via cart checkout (not pre-order flow). */
export function isAvailableForPurchase(status?: string | null): boolean {
  return status === "available";
}

/** Vehicle is listed for pre-order only (admin inventory). */
export function isPreorderListing(status?: string | null): boolean {
  return status === "pre_order";
}

export type VehicleCheckoutMode = "checkout" | "preorder" | "unavailable";

/** How a cart line should be fulfilled at checkout time. */
export function resolveVehicleCheckoutMode(
  status: string | null | undefined,
  intent: "buy" | "pre_order" = "buy"
): VehicleCheckoutMode {
  if (status === "sold") return "unavailable";
  if (isPreorderListing(status) || intent === "pre_order") return "preorder";
  if (isAvailableForPurchase(status)) return "checkout";
  // reserved or other non-available states — offer pre-order path
  if (status === "reserved") return "preorder";
  return "unavailable";
}
