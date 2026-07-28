import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import {
  isEphemeralAdminNotificationId,
  LOW_STOCK_NOTIFICATION_ID,
} from "@/lib/platform/notification-read-state";
import {
  normalizeBatchIds,
  recordTrashEntry,
  softDeleteEntity,
} from "@/lib/platform/trash";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistedAdminNotificationId(id: string): boolean {
  return UUID_RE.test(id.trim());
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

export function filterOutTrashedAdminNotifications<T extends { id: string }>(
  notifications: T[],
  trashedIds: Set<string>
): T[] {
  if (trashedIds.size === 0) return notifications;
  return notifications.filter((n) => !trashedIds.has(n.id));
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
    else failed.push({ id, message: result.message });
  }

  return { deletedIds, failed };
}
