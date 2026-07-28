import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import { actorIsOwner, actorUserId } from "@/lib/platform/team-messages";
import { fetchPreorderInquiries } from "@/lib/platform/data";
import {
  buildPreorderMetadata,
  vehicleTitleFromRow,
} from "@/lib/platform/preorder";
import { formatPlatformPrice } from "@/lib/currency";
import {
  enhanceAdminNotification,
  mapNotificationLogToAdminNotification,
} from "@/lib/platform/notification-display";
import {
  adminNotificationRecipientScope,
  applyDismissalsToNotifications,
  listDismissedAdminNotificationKeys,
  LOW_STOCK_NOTIFICATION_ID,
} from "@/lib/platform/notification-read-state";
import {
  filterOutTrashedAdminNotifications,
  listTrashedAdminNotificationIds,
} from "@/lib/platform/admin-notification-trash";
import { buildFleetLowStockMessage } from "@/lib/vehicles/low-stock";
import { reportSchemaIssue } from "@/lib/observability/schema-issue";

export type AdminNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  sourceTable: string | null;
  sourceId: string | null;
  readAt: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  source_table: string | null;
  source_id: string | null;
  read_at: string | null;
  created_at: string;
  recipient_user_id?: string | null;
  recipient_is_owner?: boolean;
  metadata?: Record<string, unknown> | null;
};

function isGlobalNotification(row: NotificationRow): boolean {
  return !row.recipient_user_id && !row.recipient_is_owner;
}

export function notificationMatchesRecipient(
  row: NotificationRow,
  auth: PlatformAuthContext
): boolean {
  if (isGlobalNotification(row)) return true;
  if (actorIsOwner(auth)) return Boolean(row.recipient_is_owner);
  return row.recipient_user_id === actorUserId(auth);
}

function recipientFilterOr(auth: PlatformAuthContext): string {
  if (actorIsOwner(auth)) {
    return "and(recipient_user_id.is.null,recipient_is_owner.eq.false),recipient_is_owner.eq.true";
  }
  const userId = actorUserId(auth);
  return `and(recipient_user_id.is.null,recipient_is_owner.eq.false),recipient_user_id.eq.${userId}`;
}

function mapRow(row: NotificationRow): AdminNotification {
  return enhanceAdminNotification({
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    link: row.link,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    readAt: row.read_at,
    createdAt: row.created_at,
    metadata: row.metadata ?? undefined,
  });
}

const OPEN_STATUSES = ["new", "pending"];

async function countOpen(
  supabase: SupabaseClient,
  table: string,
  statusColumn = "status"
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .in(statusColumn, OPEN_STATUSES);

  if (error) return 0;
  return count ?? 0;
}

export async function buildFallbackNotifications(
  supabase: SupabaseClient,
  availableVehicles: number,
  options?: { lowStockThreshold?: number; notifyLowStockEnabled?: boolean }
): Promise<AdminNotification[]> {
  const lowStockThreshold = options?.lowStockThreshold ?? 5;
  const notifyLowStockEnabled = options?.notifyLowStockEnabled ?? true;
  const items: AdminNotification[] = [];
  const now = new Date().toISOString();

  const addRows = async (
    table: string,
    type: string,
    title: string,
    link: string,
    mapMessage: (row: Record<string, unknown>) => string,
    mapLink?: (row: Record<string, unknown>) => string,
    mapMetadata?: (row: Record<string, unknown>) => Record<string, unknown> | undefined,
    statuses: string[] = OPEN_STATUSES
  ) => {
    const { data } = await supabase
      .from(table)
      .select("*")
      .in("status", statuses)
      .order("created_at", { ascending: false })
      .limit(20);

    for (const row of data ?? []) {
      const record = row as Record<string, unknown>;
      items.push({
        id: `${table}-${row.id}`,
        type,
        title,
        message: mapMessage(record),
        link: mapLink ? mapLink(record) : link,
        sourceTable: table,
        sourceId: String(row.id),
        readAt: null,
        createdAt: String(row.created_at ?? now),
        metadata: mapMetadata?.(record),
      });
    }
  };

  const addPreorderRows = async () => {
    const rows = await fetchPreorderInquiries(supabase);
    for (const row of rows.filter((r) => OPEN_STATUSES.includes(String(r.status ?? "new")))) {
      const down = row.down_payment_usd
        ? formatPlatformPrice(Number(row.down_payment_usd))
        : formatPlatformPrice(0);
      items.push({
        id: `preorder_inquiries-${row.id}`,
        type: "preorder",
        title: `Pre-order: ${vehicleTitleFromRow(row)}`,
        message: `${row.name} · ${vehicleTitleFromRow(row)} · ${down} down`,
        link: `/platform/leads/preorder/${row.id}`,
        sourceTable: "preorder_inquiries",
        sourceId: String(row.id),
        readAt: null,
        createdAt: String(row.created_at ?? now),
        metadata: buildPreorderMetadata(row) as Record<string, unknown>,
      });
    }
  };

  await Promise.all([
    addPreorderRows(),
    addRows(
      "vehicle_inquiries",
      "vehicle",
      "New vehicle inquiry",
      "/platform/leads?tab=vehicle",
      (r) =>
        `${r.name} inquired about ${r.vehicle_name ?? r.vehicle_slug ?? "a vehicle"}`
    ),
    addRows(
      "contact_inquiries",
      "contact",
      "New contact message",
      "/platform/leads?tab=contact",
      (r) => `${r.name}: ${String(r.subject ?? r.message ?? "").slice(0, 80)}`
    ),
    addRows(
      "finance_applications",
      "finance",
      "New finance application",
      "/platform/leads?tab=finance",
      (r) => `${r.first_name} ${r.last_name} applied for financing`
    ),
    addRows(
      "appraisal_requests",
      "appraisal",
      "New appraisal request",
      "/platform/leads?tab=appraisal",
      (r) =>
        `${r.seller_name} wants to sell a ${r.year} ${r.make} ${r.model}`
    ),
    addRows(
      "freight_quote_requests",
      "freight_quote",
      "New freight quote request",
      "/platform/freight/quotes",
      (r) => {
        const service = String(r.service_type ?? "quote").replace(/_/g, " ");
        const origin = r.origin_country ? ` from ${r.origin_country}` : "";
        return `${r.name} requested ${service}${origin}`;
      }
    ),
    addRows(
      "customer_conversations",
      "customer_message",
      "Customer message",
      "/platform/messages",
      (r) =>
        `${r.customer_name}: ${String(r.subject ?? "").slice(0, 80)}`,
      (r) =>
        `/platform/messages?conversation=${encodeURIComponent(String(r.id ?? ""))}`,
      undefined,
      ["open", "available", "claimed"]
    ),
  ]);

  if (notifyLowStockEnabled && availableVehicles < lowStockThreshold) {
    items.unshift({
      id: "low-stock",
      type: "low_stock",
      title: "Low inventory alert",
      message: buildFleetLowStockMessage(availableVehicles, lowStockThreshold),
      link: "/platform/inventory?stock=low",
      sourceTable: null,
      sourceId: null,
      readAt: null,
      createdAt: now,
      metadata: {
        available_vehicles: availableVehicles,
        threshold: lowStockThreshold,
        suggestion: "add_or_import",
      },
    });
  }

  return items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function fetchAdminNotifications(
  supabase: SupabaseClient,
  availableVehicles: number,
  limit = 50,
  auth?: PlatformAuthContext | null,
  options?: { lowStockThreshold?: number; notifyLowStockEnabled?: boolean }
): Promise<{ notifications: AdminNotification[]; fromTable: boolean }> {
  const lowStockThreshold = options?.lowStockThreshold ?? 5;
  const notifyLowStockEnabled = options?.notifyLowStockEnabled ?? true;
  let query = supabase.from("admin_notifications").select("*").is("deleted_at", null);
  if (auth) {
    query = query.or(recipientFilterOr(auth));
  }
  let { data, error } = await query.order("created_at", { ascending: false }).limit(limit);

  // Graceful fallback when migration 080 (deleted_at) is not applied yet.
  if (error && /deleted_at/i.test(error.message)) {
    reportSchemaIssue({
      table: "admin_notifications",
      column: "deleted_at",
      migration: "080_admin_notification_soft_delete.sql",
      source: "fetchAdminNotifications",
      message: error.message,
    });
    let fallbackQuery = supabase.from("admin_notifications").select("*");
    if (auth) {
      fallbackQuery = fallbackQuery.or(recipientFilterOr(auth));
    }
    const retry = await fallbackQuery.order("created_at", { ascending: false }).limit(limit);
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    const fallback = await buildFallbackNotifications(supabase, availableVehicles, options);
    const trashedIds = await listTrashedAdminNotificationIds(supabase);
    return {
      notifications: filterOutTrashedAdminNotifications(fallback, trashedIds).slice(0, limit),
      fromTable: false,
    };
  }

  const notifications = (data ?? []).map((row) => mapRow(row as NotificationRow));

  if (notifyLowStockEnabled && availableVehicles < lowStockThreshold) {
    const hasLowStock = notifications.some((n) => n.type === "low_stock");
    if (!hasLowStock) {
      notifications.unshift({
        id: "low-stock",
        type: "low_stock",
        title: "Low inventory alert",
        message: buildFleetLowStockMessage(availableVehicles, lowStockThreshold),
        link: "/platform/inventory?stock=low",
        sourceTable: null,
        sourceId: null,
        readAt: null,
        createdAt: new Date().toISOString(),
        metadata: {
          available_vehicles: availableVehicles,
          threshold: lowStockThreshold,
          suggestion: "add_or_import",
        },
      });
    }
  }

  const { data: failedDeliveries } = await supabase
    .from("notification_log")
    .select("id, template, channel, status, recipient, detail, created_at, source_table, source_id")
    .in("status", ["failed", "deferred", "undeliverable"])
    .order("created_at", { ascending: false })
    .limit(5);

  for (const row of failedDeliveries ?? []) {
    const mapped = mapNotificationLogToAdminNotification(row);
    const exists = notifications.some((n) => n.id === mapped.id);
    if (exists) continue;
    notifications.unshift(mapped);
  }

  let finalNotifications = notifications.slice(0, limit);
  const trashedIds = await listTrashedAdminNotificationIds(supabase);
  finalNotifications = filterOutTrashedAdminNotifications(finalNotifications, trashedIds);

  if (auth) {
    const scope = adminNotificationRecipientScope(auth);
    const dismissedKeys = await listDismissedAdminNotificationKeys(supabase, scope);
    finalNotifications = applyDismissalsToNotifications(finalNotifications, dismissedKeys);
  }

  return { notifications: finalNotifications, fromTable: true };
}

export async function countUnreadNotifications(
  supabase: SupabaseClient,
  availableVehicles: number,
  auth?: PlatformAuthContext | null,
  options?: { lowStockThreshold?: number; notifyLowStockEnabled?: boolean }
): Promise<number> {
  const lowStockThreshold = options?.lowStockThreshold ?? 5;
  const notifyLowStockEnabled = options?.notifyLowStockEnabled ?? true;
  let query = supabase
    .from("admin_notifications")
    .select("*", { count: "exact", head: true })
    .is("read_at", null)
    .is("deleted_at", null);
  if (auth) {
    query = query.or(recipientFilterOr(auth));
  }
  let { count, error } = await query;

  if (error && /deleted_at/i.test(error.message)) {
    reportSchemaIssue({
      table: "admin_notifications",
      column: "deleted_at",
      migration: "080_admin_notification_soft_delete.sql",
      source: "countUnreadNotifications",
      message: error.message,
    });
    let fallbackQuery = supabase
      .from("admin_notifications")
      .select("*", { count: "exact", head: true })
      .is("read_at", null);
    if (auth) {
      fallbackQuery = fallbackQuery.or(recipientFilterOr(auth));
    }
    const retry = await fallbackQuery;
    count = retry.count;
    error = retry.error;
  }

  if (error) {
    const fallback = await buildFallbackNotifications(supabase, availableVehicles, options);
    const trashedIds = await listTrashedAdminNotificationIds(supabase);
    return filterOutTrashedAdminNotifications(fallback, trashedIds).length;
  }

  const trashedIds = await listTrashedAdminNotificationIds(supabase);

  let unread = count ?? 0;
  if (notifyLowStockEnabled && availableVehicles < lowStockThreshold) {
    if (!trashedIds.has(LOW_STOCK_NOTIFICATION_ID)) {
      if (auth) {
        const scope = adminNotificationRecipientScope(auth);
        const dismissedKeys = await listDismissedAdminNotificationKeys(supabase, scope);
        if (!dismissedKeys.has(LOW_STOCK_NOTIFICATION_ID)) unread += 1;
      } else {
        unread += 1;
      }
    }
  }
  return unread;
}

export async function countOpenInquiries(supabase: SupabaseClient) {
  const [preorder, vehicle, contact, finance, appraisal, freightQuotes] = await Promise.all([
    countOpen(supabase, "preorder_inquiries"),
    countOpen(supabase, "vehicle_inquiries"),
    countOpen(supabase, "contact_inquiries"),
    countOpen(supabase, "finance_applications"),
    countOpen(supabase, "appraisal_requests"),
    countOpen(supabase, "freight_quote_requests"),
  ]);

  return { preorder, vehicle, contact, finance, appraisal, freightQuotes };
}
