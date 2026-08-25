import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import { actorUserId } from "@/lib/platform/team-messages";
import type { AdminNotification } from "@/lib/platform/types";
import {
  SCHEMA_CAPS,
  isMissingRelationError,
  isSchemaMissing,
  markSchemaMissing,
  markSchemaPresent,
} from "@/lib/observability/schema-capability";

/** One warn per process for missing dismissals table (client-safe; no server-only). */
let dismissalsMissingWarned = false;

function noteDismissalsMissing(message: string): void {
  markSchemaMissing(SCHEMA_CAPS.adminNotificationDismissals);
  if (dismissalsMissingWarned) return;
  dismissalsMissingWarned = true;
  console.warn(
    JSON.stringify({
      event: "schema_issue",
      table: "admin_notification_dismissals",
      migration: "075 / 086_postgres_error_clearance.sql",
      message: message.slice(0, 300),
    })
  );
}

export const LOW_STOCK_NOTIFICATION_ID = "low-stock";

export function isEphemeralAdminNotificationId(id: string): boolean {
  return id === LOW_STOCK_NOTIFICATION_ID || id.startsWith("notification-log-");
}

export function adminNotificationRecipientScope(auth: PlatformAuthContext): string {
  if (auth.type === "owner") return "owner";
  const userId = actorUserId(auth);
  return userId ? `user:${userId}` : "user:unknown";
}

export function countUnreadAdminNotifications(
  notifications: Array<{ readAt: string | null }>
): number {
  return notifications.filter((notification) => !notification.readAt).length;
}

/** Preserve optimistic read state when a poll/refetch races the mark-read API. */
export function mergeLoadedNotificationReadState<T extends { id: string; readAt: string | null }>(
  previous: T[],
  incoming: T[]
): T[] {
  const readAtById = new Map<string, string>();
  for (const notification of previous) {
    if (notification.readAt) {
      readAtById.set(notification.id, notification.readAt);
    }
  }

  return incoming.map((notification) => {
    const preservedReadAt = readAtById.get(notification.id);
    if (preservedReadAt && !notification.readAt) {
      return { ...notification, readAt: preservedReadAt };
    }
    return notification;
  });
}

/** @deprecated Use mergeLoadedNotificationReadState */
export function mergeLoadedAdminNotifications(
  previous: AdminNotification[],
  incoming: AdminNotification[]
): AdminNotification[] {
  return mergeLoadedNotificationReadState(previous, incoming);
}

export function applyDismissalsToNotifications(
  notifications: AdminNotification[],
  dismissedKeys: Set<string>,
  dismissedAt = new Date().toISOString()
): AdminNotification[] {
  if (dismissedKeys.size === 0) return notifications;

  return notifications.map((notification) => {
    if (notification.readAt || !dismissedKeys.has(notification.id)) {
      return notification;
    }
    return { ...notification, readAt: dismissedAt };
  });
}

export async function listDismissedAdminNotificationKeys(
  supabase: SupabaseClient,
  scope: string
): Promise<Set<string>> {
  if (isSchemaMissing(SCHEMA_CAPS.adminNotificationDismissals)) {
    return new Set();
  }

  const { data, error } = await supabase
    .from("admin_notification_dismissals")
    .select("notification_key")
    .eq("scope", scope);

  if (error) {
    if (isMissingRelationError(error.message, "admin_notification_dismissals")) {
      noteDismissalsMissing(error.message);
      return new Set();
    }
    console.error("[admin_notification_dismissals] list failed:", error.message);
    return new Set();
  }

  markSchemaPresent(SCHEMA_CAPS.adminNotificationDismissals);
  return new Set((data ?? []).map((row) => String(row.notification_key)));
}

export async function dismissAdminNotificationKeys(
  supabase: SupabaseClient,
  scope: string,
  keys: string[]
): Promise<void> {
  const uniqueKeys = [...new Set(keys.filter(Boolean))];
  if (uniqueKeys.length === 0) return;
  if (isSchemaMissing(SCHEMA_CAPS.adminNotificationDismissals)) return;

  const now = new Date().toISOString();
  const rows = uniqueKeys.map((notification_key) => ({
    scope,
    notification_key,
    dismissed_at: now,
  }));

  const { error } = await supabase
    .from("admin_notification_dismissals")
    .upsert(rows, { onConflict: "scope,notification_key" });

  if (error) {
    if (isMissingRelationError(error.message, "admin_notification_dismissals")) {
      noteDismissalsMissing(error.message);
      return;
    }
    console.error("[admin_notification_dismissals] upsert failed:", error.message);
  } else {
    markSchemaPresent(SCHEMA_CAPS.adminNotificationDismissals);
  }
}

export async function listEphemeralDeliveryLogNotificationKeys(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data, error } = await supabase
    .from("notification_log")
    .select("id")
    .in("status", ["failed", "deferred"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[notification_log] ephemeral list failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => `notification-log-${row.id}`);
}

export async function dismissAllEphemeralAdminNotifications(
  supabase: SupabaseClient,
  scope: string
): Promise<void> {
  const deliveryKeys = await listEphemeralDeliveryLogNotificationKeys(supabase);
  await dismissAdminNotificationKeys(supabase, scope, [
    LOW_STOCK_NOTIFICATION_ID,
    ...deliveryKeys,
  ]);
}
