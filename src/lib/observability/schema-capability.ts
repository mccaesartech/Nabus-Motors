/**
 * Process-local memory of schema gaps so we stop re-querying missing
 * columns/tables after the first failure (avoids Postgres log spam).
 *
 * Entries expire automatically so PostgREST schema-cache lag after a migration
 * (or a late `NOTIFY pgrst, 'reload schema'`) can recover without a redeploy.
 *
 * Intentionally NOT "server-only": client notification helpers also soft-fail
 * on missing relations without pulling server-only into the browser bundle.
 */

/** Default suppress window after a missing-relation failure. */
export const SCHEMA_MISSING_TTL_MS = 45_000;

/** Shorter window when the error looks like a stale PostgREST schema cache. */
export const SCHEMA_CACHE_STALE_TTL_MS = 15_000;

const missingUntil = new Map<string, number>();

export const SCHEMA_CAPS = {
  adminNotificationsDeletedAt: "admin_notifications.deleted_at",
  platformUsersDeletedAt: "platform_users.deleted_at",
  platformUsersMustChangePassword: "platform_users.must_change_password",
  platformUserInvitesEmailStatus: "platform_user_invites.email_status",
  adminNotificationDismissals: "admin_notification_dismissals",
  inventoryMovements: "inventory_movements",
  platformErrorLog: "platform_error_log",
  auditLogs: "audit_logs",
  aiUsageLogs: "ai_usage_logs",
  staffWhatsappMessages: "staff_whatsapp_messages",
  platformPasswordResetTokens: "platform_password_reset_tokens",
  customerReauthCodes: "customer_reauth_codes",
  customerSessions: "customer_sessions",
  customerLoginHistory: "customer_login_history",
  vehiclesStockQuantity: "vehicles.stock_quantity",
  vehiclesPriceCurrency: "vehicles.price_currency",
  vehiclesDeletedAt: "vehicles.deleted_at",
  exchangeRateCache: "exchange_rate_cache",
  exchangeRateSnapshots: "exchange_rate_snapshots",
} as const;

export type SchemaCapKey = (typeof SCHEMA_CAPS)[keyof typeof SCHEMA_CAPS];

export function isSchemaMissing(key: SchemaCapKey | string): boolean {
  const until = missingUntil.get(key);
  if (until == null) return false;
  if (Date.now() >= until) {
    missingUntil.delete(key);
    return false;
  }
  return true;
}

export function markSchemaMissing(
  key: SchemaCapKey | string,
  ttlMs: number = SCHEMA_MISSING_TTL_MS
): void {
  const ttl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : SCHEMA_MISSING_TTL_MS;
  missingUntil.set(key, Date.now() + ttl);
}

export function markSchemaPresent(key: SchemaCapKey | string): void {
  missingUntil.delete(key);
}

/** True when PostgREST has not picked up a table that may already exist in Postgres. */
export function isSchemaCacheStaleError(message?: string | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("schema cache") || lower.includes("could not find the table");
}

/** Detect missing relation / PostgREST schema-cache table errors. */
export function isMissingRelationError(message?: string | null, table?: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  const relationMissing =
    lower.includes("does not exist") ||
    lower.includes("schema cache") ||
    lower.includes("could not find the table");
  if (!relationMissing) return false;
  if (!table) return true;
  return lower.includes(table.toLowerCase());
}
