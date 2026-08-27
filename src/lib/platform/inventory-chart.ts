export const CLOSED_PREORDER_INQUIRY_STATUSES = ["completed", "cancelled"] as const;

export type InventoryChartSegments = {
  available: number;
  preOrderPending: number;
  preOrderConfirmed: number;
  reserved: number;
  sold: number;
};

export type PreorderInquiryLike = {
  vehicle_id?: string | null;
  payment_status?: string | null;
  status?: string | null;
};

export type VehicleLike = {
  id: string;
  status?: string | null;
};

export function isCountablePreorderInquiry(row: PreorderInquiryLike): boolean {
  const payment = row.payment_status ?? "pending";
  if (payment === "cancelled") return false;

  const status = row.status ?? "new";
  if (CLOSED_PREORDER_INQUIRY_STATUSES.includes(status as (typeof CLOSED_PREORDER_INQUIRY_STATUSES)[number])) {
    return false;
  }

  return true;
}

function isConfirmedPayment(payment: string): boolean {
  return payment === "down_payment_paid" || payment === "completed";
}

/** Fleet buckets plus inquiry-level pre-order payment counts (no vehicle deduping). */
export function computeInventoryChartSegments(
  vehicles: VehicleLike[],
  preorders: PreorderInquiryLike[]
): InventoryChartSegments {
  const activePreorders = preorders.filter(isCountablePreorderInquiry);

  let preOrderPending = 0;
  let preOrderConfirmed = 0;
  const confirmedVehicleIds = new Set<string>();

  for (const row of activePreorders) {
    const payment = row.payment_status ?? "pending";

    if (isConfirmedPayment(payment)) {
      preOrderConfirmed += 1;
      if (row.vehicle_id) confirmedVehicleIds.add(row.vehicle_id);
      continue;
    }

    if (payment === "pending") {
      // Inquiry metric only — do not soft-exclude the vehicle from Available.
      preOrderPending += 1;
    }
  }

  let available = 0;
  let reserved = 0;
  let sold = 0;

  for (const vehicle of vehicles) {
    const status = vehicle.status ?? "available";

    if (status === "sold") {
      sold += 1;
      continue;
    }

    // Deposit-paid inquiries soft-hold the unit until status flips to reserved/sold.
    // Pending-payment inquiries must NOT remove still-available cars from Available —
    // that made the dashboard look "unavailable" while Inventory still showed Available.
    if (confirmedVehicleIds.has(vehicle.id)) {
      continue;
    }

    if (status === "reserved") {
      reserved += 1;
      continue;
    }

    if (status === "pre_order") {
      preOrderPending += 1;
      continue;
    }

    available += 1;
  }

  return { available, preOrderPending, preOrderConfirmed, reserved, sold };
}
