import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPlatformPrice } from "@/lib/currency";
import { platformPath } from "@/lib/platform/paths";
import { getSiteSettings } from "@/lib/platform/site-settings-server";
import { notifyStaffNewOrder } from "@/lib/platform/staff-order-notify";

export type CartOrderStaffItem = {
  label: string;
  itemType: "part" | "vehicle";
  intent?: "buy" | "pre_order" | null;
  quantity: number;
};

export type CartOrderStaffInput = {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  items: CartOrderStaffItem[];
  totalUsd: number;
};

export function buildCartOrderStaffContent(input: CartOrderStaffInput): {
  notificationType: string;
  title: string;
  message: string;
} {
  const vehicleItems = input.items.filter((item) => item.itemType === "vehicle");
  const partItems = input.items.filter((item) => item.itemType === "part");
  const summary = input.items
    .map((item) => {
      if (item.itemType === "vehicle") {
        const intent = item.intent === "pre_order" ? "Pre-order" : "Buy";
        return `${item.label} (${intent})`;
      }
      return `${item.label} × ${item.quantity}`;
    })
    .join(", ");
  const ref = input.orderId.slice(0, 8).toUpperCase();
  const total = formatPlatformPrice(input.totalUsd);
  const contact = [input.customerName, input.customerEmail, input.customerPhone?.trim()]
    .filter(Boolean)
    .join(" · ");

  if (vehicleItems.length > 0 && partItems.length === 0) {
    const allPreOrder = vehicleItems.every((item) => item.intent === "pre_order");
    const notificationType = allPreOrder ? "preorder" : "vehicle_order";
    const kindLabel = allPreOrder ? "Vehicle pre-order" : "Vehicle purchase";
    const vehicleLabel = vehicleItems[0]?.label ?? "vehicle";
    const title =
      vehicleItems.length > 1
        ? `${kindLabel} — ${vehicleItems.length} vehicles`
        : `${kindLabel}: ${vehicleLabel}`;
    return {
      notificationType,
      title,
      message: `${summary} — ${contact} (ref ${ref}) · ${total}. Please attend to this customer promptly.`,
    };
  }

  const title =
    partItems.length > 0 && vehicleItems.length === 0
      ? `New parts order — ${partItems.length} item(s)`
      : `New cart order — ${input.items.length} item(s)`;

  return {
    notificationType: "order",
    title,
    message: `${summary} — ${contact} (ref ${ref}) · ${total}. Please attend to this order promptly.`,
  };
}

/** Notify staff for any cart checkout (parts, vehicles, or mixed). One alert per order. */
export async function notifyCartOrderToStaff(
  supabase: SupabaseClient,
  input: CartOrderStaffInput
): Promise<void> {
  const { notificationType, title, message } = buildCartOrderStaffContent(input);
  const settings = await getSiteSettings();
  const hasPreOrderVehicle = input.items.some(
    (item) => item.itemType === "vehicle" && item.intent === "pre_order"
  );
  const outboundEnabled =
    settings.notifyEmailEnabled &&
    (!hasPreOrderVehicle || settings.notifyPreordersEnabled);

  await notifyStaffNewOrder(supabase, {
    notificationType,
    title,
    message,
    link: vehicleOrderLeadsLink(input.orderId),
    sourceTable: "parts_orders",
    sourceId: input.orderId,
    permission: "leads",
    outboundEnabled,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    metadata: {
      item_count: input.items.length,
      total_usd: input.totalUsd,
      items: input.items.map((item) => ({
        label: item.label,
        type: item.itemType,
        intent: item.intent ?? null,
        quantity: item.quantity,
      })),
    },
  });
}

export type VehicleSaleNotificationInput = {
  kind: "buy" | "pre_order";
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  vehicleTitles: string[];
  referenceId: string;
  sourceTable: "parts_orders" | "preorder_inquiries";
  link: string;
  totalUsd?: number | null;
  registrationId?: string | null;
};

function buildSaleMessage(input: VehicleSaleNotificationInput): string {
  const vehicles = input.vehicleTitles.join(", ") || "vehicle";
  const contact = [input.customerName, input.customerEmail, input.customerPhone?.trim()]
    .filter(Boolean)
    .join(" · ");
  const kindLabel = input.kind === "buy" ? "Purchase" : "Pre-order";
  const ref =
    input.registrationId?.trim() ||
    input.referenceId.slice(0, 8).toUpperCase();
  const total =
    input.totalUsd != null && input.totalUsd > 0
      ? ` · ${formatPlatformPrice(input.totalUsd)}`
      : "";
  return `${kindLabel}: ${vehicles} — ${contact} (ref ${ref})${total}. Please attend to this customer promptly.`;
}

function buildSaleTitle(input: VehicleSaleNotificationInput): string {
  const kindLabel = input.kind === "buy" ? "Vehicle purchase" : "Vehicle pre-order";
  const vehicle = input.vehicleTitles[0] ?? "vehicle";
  return input.vehicleTitles.length > 1
    ? `${kindLabel} — ${input.vehicleTitles.length} vehicles`
    : `${kindLabel}: ${vehicle}`;
}

/** Target owner + leads-enabled team in the bell, email, and SMS. */
export async function notifyVehicleSaleToLeadsTeam(
  supabase: SupabaseClient,
  input: VehicleSaleNotificationInput
): Promise<void> {
  const title = buildSaleTitle(input);
  const message = buildSaleMessage(input);
  const notificationType = input.kind === "buy" ? "vehicle_order" : "preorder";

  const settings = await getSiteSettings();
  const outboundEnabled =
    settings.notifyEmailEnabled &&
    (input.kind === "pre_order" ? settings.notifyPreordersEnabled : true);

  await notifyStaffNewOrder(supabase, {
    notificationType,
    title,
    message,
    link: input.link,
    sourceTable: input.sourceTable,
    sourceId: input.referenceId,
    permission: "leads",
    outboundEnabled,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    metadata: {
      kind: input.kind,
      vehicles: input.vehicleTitles,
      registration_id: input.registrationId ?? null,
      total_usd: input.totalUsd ?? null,
    },
  });
}

export function vehicleOrderLeadsLink(orderId: string): string {
  return `${platformPath("leads")}/order/${orderId}`;
}

export function preorderLeadsLink(inquiryId: string): string {
  return `${platformPath("leads")}/preorder/${inquiryId}`;
}
