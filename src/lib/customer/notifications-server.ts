import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  accountAppointmentLink,
  accountMessageLink,
  accountOrderLink,
  accountPreorderLink,
  accountShipmentLink,
  accountVehicleRequestLink,
  type CustomerNotification,
  type CustomerNotificationType,
} from "@/lib/customer/notification-types";
import { customRequestStatusLabel } from "@/lib/platform/custom-request";
import {
  customerFacingStaffReplyTitle,
  sanitizeCustomerNotificationTitle,
} from "@/lib/customer/public-branding";

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  source_table: string | null;
  source_id: string | null;
  read_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export function mapCustomerNotification(row: NotificationRow): CustomerNotification {
  return {
    id: row.id,
    type: row.type,
    title: sanitizeCustomerNotificationTitle(row.title),
    body: row.body,
    link: row.link,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    readAt: row.read_at,
    createdAt: row.created_at,
    metadata: row.metadata ?? undefined,
  };
}

export type CreateCustomerNotificationParams = {
  userId: string | null | undefined;
  type: CustomerNotificationType | string;
  title: string;
  body: string;
  link?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
  dedupe?: boolean;
};

export async function createCustomerNotification(
  supabase: SupabaseClient,
  params: CreateCustomerNotificationParams
): Promise<CustomerNotification | null> {
  const userId = params.userId?.trim();
  if (!userId) return null;

  const row = {
    user_id: userId,
    type: params.type,
    title: params.title,
    body: params.body,
    link: params.link ?? null,
    source_table: params.sourceTable ?? null,
    source_id: params.sourceId ?? null,
    metadata: params.metadata ?? {},
  };

  if (params.dedupe && row.source_table && row.source_id) {
    const { data: existing } = await supabase
      .from("customer_notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", row.type)
      .eq("source_table", row.source_table)
      .eq("source_id", row.source_id)
      .maybeSingle();

    if (existing) return null;
  }

  const { data, error } = await supabase
    .from("customer_notifications")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") return null;
    console.error("[customer_notifications] insert failed:", error.message);
    return null;
  }

  return mapCustomerNotification(data as NotificationRow);
}

export async function fetchCustomerNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 50
): Promise<CustomerNotification[]> {
  const { data, error } = await supabase
    .from("customer_notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[customer_notifications] fetch failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => mapCustomerNotification(row as NotificationRow));
}

export async function notifyCustomerOrderSubmitted(
  supabase: SupabaseClient,
  params: { userId: string | null | undefined; orderId: string; itemCount: number }
): Promise<void> {
  await createCustomerNotification(supabase, {
    userId: params.userId,
    type: "order_submitted",
    title: "Order received",
    body: `We received your order with ${params.itemCount} item(s). Our team will confirm details shortly.`,
    link: accountOrderLink(params.orderId),
    sourceTable: "parts_orders",
    sourceId: params.orderId,
    dedupe: true,
    metadata: { orderId: params.orderId },
  });
}

export async function notifyCustomerOrderConfirmed(
  supabase: SupabaseClient,
  params: { userId: string | null | undefined; orderId: string; orderRef: string }
): Promise<void> {
  await createCustomerNotification(supabase, {
    userId: params.userId,
    type: "order_confirmed",
    title: "Order confirmed",
    body: `Your order ${params.orderRef} has been confirmed. View details in My Orders.`,
    link: accountOrderLink(params.orderId),
    sourceTable: "parts_orders",
    sourceId: `${params.orderId}:confirmed`,
    dedupe: true,
    metadata: { orderId: params.orderId, orderRef: params.orderRef },
  });
}

export async function notifyCustomerPreorderUpdate(
  supabase: SupabaseClient,
  params: {
    userId: string | null | undefined;
    preorderId: string;
    title: string;
    status: string;
    isCustomRequest?: boolean;
  }
): Promise<void> {
  const statusLabel = params.isCustomRequest
    ? customRequestStatusLabel(params.status)
    : params.status.replace(/_/g, " ");

  await createCustomerNotification(supabase, {
    userId: params.userId,
    type: params.isCustomRequest ? "custom_request_update" : "preorder_update",
    title: params.isCustomRequest ? "Vehicle request update" : "Pre-order update",
    body: `${params.title}: status is now ${statusLabel}.`,
    link: params.isCustomRequest
      ? accountVehicleRequestLink(params.preorderId)
      : accountPreorderLink(params.preorderId),
    sourceTable: "preorder_inquiries",
    sourceId: `${params.preorderId}:${params.status}:${Date.now()}`,
    metadata: { preorderId: params.preorderId, status: params.status },
  });
}

export async function notifyCustomerCustomRequestSubmitted(
  supabase: SupabaseClient,
  params: {
    userId: string | null | undefined;
    requestId: string;
    referenceCode: string;
    vehicleTitle: string;
  }
): Promise<void> {
  await createCustomerNotification(supabase, {
    userId: params.userId,
    type: "custom_request_submitted",
    title: "Vehicle request received",
    body: `We received your request for ${params.vehicleTitle}. Reference: ${params.referenceCode}. Track status anytime in your account.`,
    link: accountVehicleRequestLink(params.requestId),
    sourceTable: "preorder_inquiries",
    sourceId: params.requestId,
    dedupe: true,
    metadata: {
      requestId: params.requestId,
      referenceCode: params.referenceCode,
    },
  });
}

export async function notifyCustomerAppointmentConfirmed(
  supabase: SupabaseClient,
  params: {
    userId: string | null | undefined;
    appointmentId: string;
    preferredDate?: string | null;
    branch?: string | null;
  }
): Promise<void> {
  const when = params.preferredDate ? ` for ${params.preferredDate}` : "";
  const where = params.branch ? ` at ${params.branch}` : "";
  await createCustomerNotification(supabase, {
    userId: params.userId,
    type: "appointment_confirmed",
    title: "Visit confirmed",
    body: `Your showroom visit${when}${where} is confirmed.`,
    link: accountAppointmentLink(),
    sourceTable: "vehicle_appointments",
    sourceId: `${params.appointmentId}:confirmed`,
    dedupe: true,
    metadata: { appointmentId: params.appointmentId },
  });
}

export async function notifyCustomerStaffMessage(
  supabase: SupabaseClient,
  params: {
    userId: string;
    conversationId: string;
    subject: string;
    preview: string;
    messageId: string;
    /** @deprecated Ignored — customers always see company branding. */
    staffName?: string;
  }
): Promise<void> {
  await createCustomerNotification(supabase, {
    userId: params.userId,
    type: "staff_message",
    title: customerFacingStaffReplyTitle(),
    body: params.preview || `New reply on: ${params.subject}`,
    link: accountMessageLink(params.conversationId),
    sourceTable: "customer_conversation_messages",
    sourceId: params.messageId,
    dedupe: true,
    metadata: {
      conversationId: params.conversationId,
      subject: params.subject,
    },
  });
}

export async function notifyCustomerShipmentUpdate(
  supabase: SupabaseClient,
  params: {
    userId: string | null | undefined;
    shipmentId: string;
    trackingNumber: string;
    statusLabel?: string;
    dedupKey?: string;
  }
): Promise<void> {
  const label = params.statusLabel ?? "updated";
  await createCustomerNotification(supabase, {
    userId: params.userId,
    type: "shipment_update",
    title: "Shipment update",
    body: `Tracking ${params.trackingNumber}: ${label}.`,
    link: accountShipmentLink(),
    sourceTable: "shipment_tracking",
    sourceId: params.dedupKey ?? `${params.shipmentId}:${label}`,
    dedupe: Boolean(params.dedupKey),
    metadata: {
      shipmentId: params.shipmentId,
      trackingNumber: params.trackingNumber,
    },
  });
}
