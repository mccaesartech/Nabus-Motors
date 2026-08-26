/**
 * Process-local memory of schema gaps so we stop re-querying missing
 * columns/tables after the first failure (avoids Postgres log spam).
 * Cleared on cold start / redeploy — correct once migrations are applied.
 *
 * Intentionally NOT "server-only": client notification helpers also soft-fail
 * on missing relations without pulling server-only into the browser bundle.
 */

const missing = new Set<string>();

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
  return missing.has(key);
}

export function markSchemaMissing(key: SchemaCapKey | string): void {
  missing.add(key);
}

export function markSchemaPresent(key: SchemaCapKey | string): void {
  missing.delete(key);
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
