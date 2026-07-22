import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import { actorUserId } from "@/lib/platform/team-messages";
import type { AdminNotification } from "@/lib/platform/types";

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
  const { data, error } = await supabase
    .from("admin_notification_dismissals")
    .select("notification_key")
    .eq("scope", scope);

  if (error) {
    console.error("[admin_notification_dismissals] list failed:", error.message);
    return new Set();
  }

  return new Set((data ?? []).map((row) => String(row.notification_key)));
}

export async function dismissAdminNotificationKeys(
  supabase: SupabaseClient,
  scope: string,
  keys: string[]
): Promise<void> {
  const uniqueKeys = [...new Set(keys.filter(Boolean))];
  if (uniqueKeys.length === 0) return;

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
    console.error("[admin_notification_dismissals] upsert failed:", error.message);
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
