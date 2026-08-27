import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import {
  isEphemeralAdminNotificationId,
  LOW_STOCK_NOTIFICATION_ID,
} from "@/lib/platform/notification-read-state";
import {
  buildEntityLabel,
  normalizeBatchIds,
  recordTrashEntry,
  softDeleteEntity,
} from "@/lib/platform/trash";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Tables that support soft-delete via deleted_at — used to hide orphaned delivery alerts. */
const SOFT_DELETE_SOURCE_TABLES = new Set([
  "contact_inquiries",
  "vehicle_inquiries",
  "preorder_inquiries",
  "finance_applications",
  "appraisal_requests",
  "freight_quote_requests",
  "customer_conversations",
  "parts_orders",
  "vehicles",
]);

export function isPersistedAdminNotificationId(id: string): boolean {
  return UUID_RE.test(id.trim());
}

export function ephemeralNotificationLogId(logId: string): string {
  return `notification-log-${logId.trim()}`;
}

export async function listTrashedAdminNotificationIds(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("platform_trash")
    .select("entity_id")
    .eq("entity_type", "admin_notification")
    .is("restored_at", null)
    .is("permanently_deleted_at", null);

  if (error) {
    console.error("[admin_notification trash] list failed:", error.message);
    return new Set();
  }

  return new Set((data ?? []).map((row) => String(row.entity_id)));
}

/** Sent-email trash entity ids — used to hide ephemeral delivery notifications. */
export async function listTrashedSentEmailIds(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("platform_trash")
    .select("entity_id")
    .eq("entity_type", "sent_email")
    .is("restored_at", null)
    .is("permanently_deleted_at", null);

  if (error) {
    console.error("[sent_email trash] list failed:", error.message);
    return new Set();
  }

  return new Set((data ?? []).map((row) => String(row.entity_id)));
}

export function filterOutTrashedAdminNotifications<T extends { id: string }>(
  notifications: T[],
  trashedIds: Set<string>
): T[] {
  if (trashedIds.size === 0) return notifications;
  return notifications.filter((n) => !trashedIds.has(n.id));
}

/**
 * Drop synthetic delivery notifications whose notification_log row was trashed
 * (or whose ephemeral notification-log-* id was trashed).
 */
export function filterOutTrashedDeliveryNotifications<T extends { id: string }>(
  notifications: T[],
  trashedSentEmailIds: Set<string>,
  trashedAdminNotificationIds: Set<string>
): T[] {
  if (trashedSentEmailIds.size === 0 && trashedAdminNotificationIds.size === 0) {
    return notifications;
  }
  return notifications.filter((n) => {
    if (trashedAdminNotificationIds.has(n.id)) return false;
    if (!n.id.startsWith("notification-log-")) return true;
    const logId = n.id.slice("notification-log-".length);
    return !trashedSentEmailIds.has(logId);
  });
}

async function findActiveAdminNotificationTrash(
  supabase: SupabaseClient,
  entityId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("platform_trash")
    .select("id")
    .eq("entity_type", "admin_notification")
    .eq("entity_id", entityId)
    .is("restored_at", null)
    .is("permanently_deleted_at", null)
    .maybeSingle();

  return data?.id ? String(data.id) : null;
}

async function findActiveSentEmailTrash(
  supabase: SupabaseClient,
  entityId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("platform_trash")
    .select("id")
    .eq("entity_type", "sent_email")
    .eq("entity_id", entityId)
    .is("restored_at", null)
    .is("permanently_deleted_at", null)
    .maybeSingle();

  return data?.id ? String(data.id) : null;
}

function notificationLabel(snapshot: Record<string, unknown>): string {
  const title = String(snapshot.title ?? "").trim();
  if (title) return title;
  const message = String(snapshot.message ?? "").trim();
  if (message) return message.slice(0, 80);
  return "Notification";
}

/**
 * Soft-delete an admin notification into platform_trash.
 * Persisted UUID rows use deleted_at when available; ephemeral / synthetic ids
 * are hidden via trash entity_id filtering on fetch.
 */
export async function softDeleteAdminNotification(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  id: string,
  snapshot?: Record<string, unknown>
): Promise<{ ok: true; trashId: string } | { ok: false; message: string; status?: number }> {
  const notificationId = id.trim();
  if (!notificationId) {
    return { ok: false, message: "Missing id", status: 400 };
  }

  if (notificationId === LOW_STOCK_NOTIFICATION_ID) {
    return {
      ok: false,
      message: "Low inventory alerts cannot be deleted. Resolve stock levels instead.",
      status: 400,
    };
  }

  const already = await findActiveAdminNotificationTrash(supabase, notificationId);
  if (already) {
    return { ok: false, message: "Notification is already in trash.", status: 400 };
  }

  if (isPersistedAdminNotificationId(notificationId)) {
    const result = await softDeleteEntity(
      supabase,
      auth,
      "admin_notification",
      notificationId
    );
    if (result.ok) return result;

    // Migration 080 not applied yet — still hide via trash + fetch filter.
    if (/deleted_at/i.test(result.message) || /schema cache/i.test(result.message)) {
      const { data: row } = await supabase
        .from("admin_notifications")
        .select("*")
        .eq("id", notificationId)
        .maybeSingle();

      const snap = (row as Record<string, unknown> | null) ??
        snapshot ?? { id: notificationId, title: "Notification" };
      const trash = await recordTrashEntry(
        supabase,
        auth,
        "admin_notification",
        notificationId,
        notificationLabel(snap),
        snap
      );
      if (!trash.ok) return { ok: false, message: trash.message, status: 500 };
      return { ok: true, trashId: trash.id };
    }

    // Not in table — fall through to snapshot/ephemeral path.
    if (result.status !== 404) {
      return result;
    }
  }

  const snap =
    snapshot && Object.keys(snapshot).length > 0
      ? snapshot
      : {
          id: notificationId,
          title: "Notification",
          ephemeral: isEphemeralAdminNotificationId(notificationId),
        };

  const trash = await recordTrashEntry(
    supabase,
    auth,
    "admin_notification",
    notificationId,
    notificationLabel(snap),
    { ...snap, id: notificationId }
  );

  if (!trash.ok) {
    return { ok: false, message: trash.message, status: 500 };
  }

  return { ok: true, trashId: trash.id };
}

/**
 * Soft-delete admin notifications linked to a source row (moves to trash, not hard delete).
 */
export async function softDeleteAdminNotificationsBySource(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  sourceTable: string,
  sourceIds: string | string[]
): Promise<void> {
  const ids = (Array.isArray(sourceIds) ? sourceIds : [sourceIds])
    .map((id) => id.trim())
    .filter(Boolean);
  if (ids.length === 0) return;

  const { data, error } = await supabase
    .from("admin_notifications")
    .select("id")
    .eq("source_table", sourceTable)
    .in("source_id", ids);

  if (!error && data?.length) {
    await softDeleteAdminNotifications(
      supabase,
      auth,
      data.map((row) => String(row.id))
    );
  }
}

/**
 * Trash + hard-delete notification_log rows for a deleted source entity so the
 * notification center cannot re-inject failed/deferred delivery alerts.
 */
export async function trashNotificationLogsBySource(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  sourceTable: string,
  sourceIds: string | string[]
): Promise<void> {
  const ids = (Array.isArray(sourceIds) ? sourceIds : [sourceIds])
    .map((id) => id.trim())
    .filter(Boolean);
  if (ids.length === 0) return;

  const { data, error } = await supabase
    .from("notification_log")
    .select("*")
    .eq("source_table", sourceTable)
    .in("source_id", ids);

  if (error || !data?.length) return;

  for (const row of data) {
    const logId = String(row.id);
    const snapshot = { ...(row as Record<string, unknown>) };
    const already = await findActiveSentEmailTrash(supabase, logId);
    if (!already) {
      const trash = await recordTrashEntry(
        supabase,
        auth,
        "sent_email",
        logId,
        buildEntityLabel("sent_email", snapshot),
        snapshot
      );
      if (!trash.ok) {
        console.error("[notification_log trash] record failed:", trash.message);
        continue;
      }
    }

    await hideEphemeralDeliveryNotification(supabase, auth, logId, {
      id: ephemeralNotificationLogId(logId),
      title: buildEntityLabel("sent_email", snapshot),
      ephemeral: true,
      source_table: sourceTable,
      source_id: snapshot.source_id ?? null,
    });

    const { error: deleteError } = await supabase
      .from("notification_log")
      .delete()
      .eq("id", logId);
    if (deleteError) {
      console.error("[notification_log trash] delete failed:", deleteError.message);
    }
  }
}

/**
 * Clear persisted admin notifications and related delivery-log alerts for a
 * deleted source entity (inquiry, message, etc.).
 */
export async function clearNotificationsForDeletedSource(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  sourceTable: string,
  sourceIds: string | string[]
): Promise<void> {
  await softDeleteAdminNotificationsBySource(supabase, auth, sourceTable, sourceIds);
  await trashNotificationLogsBySource(supabase, auth, sourceTable, sourceIds);
}

/**
 * Hide ephemeral delivery notification for a trashed/deleted notification_log row.
 * Ignores "already in trash" so callers can be idempotent.
 */
export async function hideEphemeralDeliveryNotification(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  logId: string,
  snapshot?: Record<string, unknown>
): Promise<void> {
  const ephemeralId = ephemeralNotificationLogId(logId);
  const result = await softDeleteAdminNotification(
    supabase,
    auth,
    ephemeralId,
    snapshot ?? {
      id: ephemeralId,
      title: "Delivery notification",
      ephemeral: true,
    }
  );
  if (!result.ok && !/already in trash/i.test(result.message)) {
    console.error(
      "[admin_notification trash] hide ephemeral failed:",
      result.message
    );
  }
}

/**
 * Filter delivery-log rows whose source entity was soft-deleted (orphan safety net).
 */
export async function filterDeliveryLogsForActiveSources<
  T extends { id: string; source_table: string | null; source_id: string | null },
>(supabase: SupabaseClient, rows: T[]): Promise<T[]> {
  if (rows.length === 0) return rows;

  const byTable = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.source_table || !row.source_id) continue;
    if (!SOFT_DELETE_SOURCE_TABLES.has(row.source_table)) continue;
    const set = byTable.get(row.source_table) ?? new Set<string>();
    set.add(row.source_id);
    byTable.set(row.source_table, set);
  }

  if (byTable.size === 0) return rows;

  const deletedKeys = new Set<string>();
  await Promise.all(
    [...byTable.entries()].map(async ([table, ids]) => {
      const idList = [...ids];
      const { data, error } = await supabase
        .from(table)
        .select("id")
        .in("id", idList)
        .not("deleted_at", "is", null);
      if (error) {
        // Column/table missing — skip orphan filter for this table.
        if (/deleted_at|schema cache|does not exist/i.test(error.message)) return;
        console.error(
          `[notification fetch] soft-deleted source check failed (${table}):`,
          error.message
        );
        return;
      }
      for (const row of data ?? []) {
        deletedKeys.add(`${table}:${row.id}`);
      }
    })
  );

  if (deletedKeys.size === 0) return rows;
  return rows.filter((row) => {
    if (!row.source_table || !row.source_id) return true;
    return !deletedKeys.has(`${row.source_table}:${row.source_id}`);
  });
}

export async function softDeleteAdminNotifications(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  ids: string[],
  snapshotsById?: Record<string, Record<string, unknown>>
): Promise<{
  deletedIds: string[];
  failed: Array<{ id: string; message: string }>;
}> {
  const normalized = normalizeBatchIds(ids);
  const deletedIds: string[] = [];
  const failed: Array<{ id: string; message: string }> = [];

  for (const id of normalized) {
    const result = await softDeleteAdminNotification(
      supabase,
      auth,
      id,
      snapshotsById?.[id]
    );
    if (result.ok) deletedIds.push(id);
    else if (/already in trash/i.test(result.message)) deletedIds.push(id);
    else failed.push({ id, message: result.message });
  }

  return { deletedIds, failed };
}
