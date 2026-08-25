/**
 * Shared types and formatting for the owner-only error-log API
 * (`/api/admin/error-log`). The Platform UI was removed in favor of Sentry.
 */

import type { AppErrorKind, ErrorSeverity } from "./kinds";

export const MIGRATION_REQUIRED_MESSAGE =
  "Error logging is not persisted yet. Run supabase/migrations/084_platform_error_log.sql in the Supabase SQL Editor to start recording errors here. Errors are still written to the server logs in the meantime.";

export type PlatformErrorLogRow = {
  id: string;
  error_id: string;
  severity: ErrorSeverity;
  kind: AppErrorKind;
  status: number;
  module: string;
  method: string | null;
  route: string | null;
  user_message: string | null;
  internal_message: string | null;
  db_code: string | null;
  actor_id: string | null;
  actor_role: string | null;
  ip: string | null;
  browser: string | null;
  os: string | null;
  environment: string | null;
  release: string | null;
  stack: string | null;
  request_body: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  resolution_note: string | null;
  created_at: string;
};

export const SEVERITY_LABELS: Record<ErrorSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const CSV_COLUMNS = [
  "error_id",
  "created_at",
  "severity",
  "kind",
  "status",
  "module",
  "method",
  "route",
  "user_message",
  "internal_message",
  "db_code",
  "actor_role",
  "browser",
  "os",
  "environment",
  "release",
  "resolved_at",
  "resolution_note",
] as const;

/** Escape a CSV cell, neutralizing spreadsheet formula injection. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/\r?\n/g, " ").trim();
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function errorLogToCsv(rows: PlatformErrorLogRow[]): string {
  const header = CSV_COLUMNS.join(",");
  const body = rows.map((row) =>
    CSV_COLUMNS.map((column) => csvCell(row[column as keyof PlatformErrorLogRow])).join(",")
  );
  return [header, ...body].join("\n");
}
