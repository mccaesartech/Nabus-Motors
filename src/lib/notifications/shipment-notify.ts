import "server-only";
import type { createAdminSupabase } from "@/lib/supabase/admin";
import { notifyCustomer, type NotifyCustomerResult } from "@/lib/notifications/customer-notify";
import { notifyCustomerShipmentUpdate } from "@/lib/customer/notifications-server";
import { shipmentStatusLabel } from "@/lib/platform/shipment";

type AdminSupabase = NonNullable<ReturnType<typeof createAdminSupabase>>;

export type ShipmentNotifyRow = {
  id: string;
  tracking_number: string;
  reference_type: string;
  reference_id: string | null;
  user_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone?: string | null;
  whatsapp_opt_in?: boolean | null;
  status?: string;
};

export type ShipmentCustomerContact = {
  email: string;
  phone: string | null;
  whatsappPreferred: boolean | undefined;
  customerName: string | undefined;
};

/** Short window to suppress accidental double-clicks / identical PATCH retries only. */
export const SHIPMENT_IDENTICAL_DEDUP_MS = 30 * 1000;

export type ShipmentUpdateFrequency = "every_update" | "milestones_only";

export async function resolveShipmentCustomerContact(
  supabase: AdminSupabase,
  shipment: ShipmentNotifyRow
): Promise<ShipmentCustomerContact> {
  let email = shipment.customer_email?.trim() || "";
  let phone = shipment.customer_phone?.trim() || null;
  let whatsappPreferred: boolean | undefined =
    shipment.whatsapp_opt_in === null || shipment.whatsapp_opt_in === undefined
      ? undefined
      : shipment.whatsapp_opt_in;
  let customerName = shipment.customer_name?.trim() || undefined;

  if (shipment.reference_type === "freight" && shipment.reference_id) {
    const { data: quote } = await supabase
      .from("freight_quote_requests")
      .select("name, email, phone, whatsapp_opt_in")
      .eq("id", shipment.reference_id)
      .maybeSingle();
    if (quote) {
      email = email || quote.email?.trim() || "";
      phone = phone || quote.phone?.trim() || null;
      if (whatsappPreferred === undefined) {
        whatsappPreferred = quote.whatsapp_opt_in ?? undefined;
      }
      customerName = customerName || quote.name?.trim() || undefined;
    }
  }

  if (shipment.reference_type === "preorder" && shipment.reference_id) {
    const { data: preorder } = await supabase
      .from("preorder_inquiries")
      .select("name, email, phone, whatsapp_opt_in")
      .eq("id", shipment.reference_id)
      .maybeSingle();
    if (preorder) {
      email = email || preorder.email?.trim() || "";
      phone = phone || preorder.phone?.trim() || null;
      if (whatsappPreferred === undefined) {
        whatsappPreferred = preorder.whatsapp_opt_in ?? undefined;
      }
      customerName = customerName || preorder.name?.trim() || undefined;
    }
  }

  if (shipment.user_id && (!phone || !email || !customerName)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email, phone, whatsapp_opt_in")
      .eq("id", shipment.user_id)
      .maybeSingle();
    if (profile) {
      email = email || profile.email?.trim() || "";
      phone = phone || profile.phone?.trim() || null;
      if (whatsappPreferred === undefined) {
        whatsappPreferred = profile.whatsapp_opt_in ?? undefined;
      }
      if (!customerName) {
        const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
        customerName = fullName || undefined;
      }
    }
  }

  return { email, phone, whatsappPreferred, customerName };
}

async function recentlyNotified(
  supabase: AdminSupabase,
  shipmentId: string,
  dedupKey: string,
  windowMs: number
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count } = await supabase
    .from("notification_log")
    .select("id", { count: "exact", head: true })
    .eq("source_table", "shipment_tracking")
    .eq("source_id", shipmentId)
    .eq("template", "shipment_status_update")
    .eq("detail", `dedup:${dedupKey}`)
    .gte("created_at", since);

  return (count ?? 0) > 0;
}

async function logShipmentDedup(
  supabase: AdminSupabase,
  shipmentId: string,
  dedupKey: string
): Promise<void> {
  try {
    await supabase.from("notification_log").insert({
      source_table: "shipment_tracking",
      source_id: shipmentId,
      template: "shipment_status_update",
      channel: "whatsapp",
      status: "skipped",
      recipient: "dedup",
      detail: `dedup:${dedupKey}`,
    });
  } catch {
    // Non-blocking
  }
}

export type ShipmentNotifyResult =
  | { attempted: false; reason: "no_contact" | "deduped" }
  | { attempted: true; notification: NotifyCustomerResult };

export async function notifyShipmentCustomerUpdate(
  supabase: AdminSupabase,
  shipment: ShipmentNotifyRow,
  options: {
    template?: "quote_converted_tracking" | "shipment_status_update";
    statusNote?: string;
    statusLabel?: string;
    /** Separate key per event type (status, notes, event) so they never block each other. */
    dedupKey?: string;
    /** When true, always send — used for explicit customer notes and timeline messages. */
    skipDedup?: boolean;
  }
): Promise<ShipmentNotifyResult> {
  const template = options.template ?? "shipment_status_update";
  const contact = await resolveShipmentCustomerContact(supabase, shipment);
  const statusLabel =
    options.statusLabel ??
    (shipment.status ? shipmentStatusLabel(shipment.status) : undefined);

  const queueInAppNotification = async () => {
    if (!shipment.user_id) return;
    await notifyCustomerShipmentUpdate(supabase, {
      userId: shipment.user_id,
      shipmentId: shipment.id,
      trackingNumber: shipment.tracking_number,
      statusLabel,
      dedupKey: options.dedupKey,
    });
  };

  if (!contact.email && !contact.phone) {
    await queueInAppNotification();
    return { attempted: false, reason: "no_contact" };
  }

  if (options.dedupKey && !options.skipDedup) {
    const duplicate = await recentlyNotified(
      supabase,
      shipment.id,
      options.dedupKey,
      SHIPMENT_IDENTICAL_DEDUP_MS
    );
    if (duplicate) {
      await queueInAppNotification();
      return { attempted: false, reason: "deduped" };
    }
  }

  const notification = await notifyCustomer({
    email: contact.email,
    phone: contact.phone,
    whatsappPreferred: contact.whatsappPreferred,
    customerName: contact.customerName,
    template,
    data: {
      trackingNumber: shipment.tracking_number,
      statusNote: options.statusNote,
      statusLabel,
    },
    sourceTable: "shipment_tracking",
    sourceId: shipment.id,
  });

  if (options.dedupKey && !options.skipDedup) {
    await logShipmentDedup(supabase, shipment.id, options.dedupKey);
  }

  await queueInAppNotification();

  return { attempted: true, notification };
}
