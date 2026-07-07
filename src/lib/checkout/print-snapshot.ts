import type { CustomerInquirySummary } from "@/lib/customer/types";
import { resolveOrderLinePricing } from "@/lib/print/order-line-pricing";
import type {
  CartLineResolved,
  CartVehicleResolved,
  PartsOrderItemSummary,
  PartsOrderSummary,
} from "@/lib/parts/cart-types";

type BuildCheckoutOrderSummaryInput = {
  orderId: string;
  partLines: CartLineResolved[];
  vehicleLines: CartVehicleResolved[];
};

export function buildCheckoutOrderSummary({
  orderId,
  partLines,
  vehicleLines,
}: BuildCheckoutOrderSummaryInput): PartsOrderSummary {
  const items: PartsOrderItemSummary[] = [
    ...partLines.map((line) => {
      const pricing = resolveOrderLinePricing(line.quantity, line.priceUsd);
      return {
        id: `part-${line.partId}`,
        item_type: "part" as const,
        name: line.name,
        slug: line.slug,
        sku: line.sku,
        quantity: pricing.quantity,
        unit_price_usd: pricing.unitPriceUsd,
        item_intent: null,
        image_url: line.image,
      };
    }),
    ...vehicleLines.map((line) => {
      const pricing = resolveOrderLinePricing(line.quantity, line.priceUsd);
      return {
        id: `vehicle-${line.vehicleId}`,
        item_type: "vehicle" as const,
        name: line.name,
        slug: line.slug,
        sku: null,
        quantity: pricing.quantity,
        unit_price_usd: pricing.unitPriceUsd,
        item_intent: "buy" as const,
        vehicle_id: line.vehicleId,
        image_url: line.image,
      };
    }),
  ];

  const totalUsd = items.reduce(
    (sum, item) => sum + resolveOrderLinePricing(item.quantity, item.unit_price_usd).lineTotalUsd,
    0
  );

  return {
    id: orderId,
    status: "pending",
    total_usd: totalUsd,
    created_at: new Date().toISOString(),
    item_count: items.length,
    items,
  };
}

type BuildPreorderPrintSnapshotInput = {
  inquiryId?: string;
  registrationId?: string;
  vehicleName: string;
  vehicleSlug?: string;
  vehiclePriceUsd?: number;
  downPaymentUsd?: number;
};

export function buildPreorderPrintSnapshot({
  inquiryId,
  registrationId,
  vehicleName,
  vehicleSlug,
  vehiclePriceUsd,
  downPaymentUsd,
}: BuildPreorderPrintSnapshotInput): CustomerInquirySummary {
  const id = inquiryId ?? crypto.randomUUID();

  return {
    id,
    type: "preorder",
    title: vehicleName,
    status: "pending",
    created_at: new Date().toISOString(),
    vehicle_price_usd: vehiclePriceUsd,
    down_payment_usd: downPaymentUsd,
    payment_status: "awaiting_down_payment",
    vehicle_slug: vehicleSlug,
    reference_code: registrationId,
  };
}
