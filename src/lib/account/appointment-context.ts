import type { CheckoutCompleteContext, CheckoutCompleteVehicle } from "@/lib/checkout/complete-context";
import type { CustomerInquirySummary } from "@/lib/customer/types";
import {
  isVehicleLine,
  type CustomerCartSummary,
  type PartsOrderSummary,
} from "@/lib/parts/cart-types";
import { isValidUuid } from "@/lib/inquiries/uuid";

export function collectVehiclesForAppointment(
  partsOrders: PartsOrderSummary[],
  cartSummary: CustomerCartSummary | null,
  preorders: CustomerInquirySummary[]
): CheckoutCompleteVehicle[] {
  const seen = new Set<string>();
  const vehicles: CheckoutCompleteVehicle[] = [];

  function add(id: string | null | undefined, name: string) {
    const key = id && isValidUuid(id) ? id : name.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    vehicles.push({ id: id && isValidUuid(id) ? id : "", name });
  }

  const recentOrder = partsOrders[0];
  if (recentOrder?.items) {
    for (const item of recentOrder.items) {
      if (item.item_type === "vehicle") {
        add(item.vehicle_id, item.name);
      }
    }
  }

  if (cartSummary?.items) {
    for (const line of cartSummary.items) {
      if (isVehicleLine(line)) {
        add(
          line.vehicleId,
          line.snapshot?.name ?? "Vehicle in cart"
        );
      }
    }
  }

  for (const preorder of preorders) {
    if (preorder.type === "preorder" && !preorder.is_custom_request) {
      add(undefined, preorder.title);
    }
  }

  return vehicles.filter((v) => v.name.trim());
}

export function buildAccountAppointmentContext(opts: {
  displayName: string;
  email: string;
  phone: string;
  registrationId?: string | null;
  partsOrders: PartsOrderSummary[];
  cartSummary: CustomerCartSummary | null;
  preorders: CustomerInquirySummary[];
}): CheckoutCompleteContext {
  const vehicles = collectVehiclesForAppointment(
    opts.partsOrders,
    opts.cartSummary,
    opts.preorders
  );

  const recentOrder = opts.partsOrders[0];

  return {
    source: "checkout",
    orderId: recentOrder?.id,
    registrationId: opts.registrationId ?? undefined,
    name: opts.displayName,
    email: opts.email,
    phone: opts.phone,
    vehicles,
  };
}
