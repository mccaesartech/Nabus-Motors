import "server-only";

import * as Sentry from "@sentry/nextjs";

export type SchemaIssueContext = {
  table: string;
  column?: string;
  migration?: string;
  source: string;
  message?: string;
};

/**
 * Report a missing-column / schema-cache issue to Sentry (and console).
 * No-ops capture when DSN is unset; never throws into request handlers.
 */
export function reportSchemaIssue(issue: SchemaIssueContext): void {
  const column = issue.column ?? "unknown";
  const migration = issue.migration ?? "unknown";
  const detail = issue.message?.slice(0, 500) ?? "schema issue";
  const title = `Schema issue: ${issue.table}.${column} (migration ${migration})`;

  console.warn(
    JSON.stringify({
      event: "schema_issue",
      table: issue.table,
      column,
      migration,
      source: issue.source,
      message: detail,
    })
  );

  const dsn =
    process.env.SENTRY_DSN?.trim() ||
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return;

  try {
    Sentry.withScope((scope) => {
      scope.setLevel("warning");
      scope.setTag("schema_issue", "true");
      scope.setTag("schema_table", issue.table);
      scope.setTag("schema_column", column);
      scope.setTag("schema_migration", migration);
      scope.setContext("schema_issue", {
        table: issue.table,
        column,
        migration,
        source: issue.source,
        message: detail,
      });
      Sentry.captureMessage(title, "warning");
    });
  } catch (err) {
    console.warn("Sentry schema issue capture failed:", err);
  }
}

export function isMissingColumnError(
  message: string | undefined,
  column: string
): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  const col = column.toLowerCase();
  if (lower.includes(col) && (lower.includes("does not exist") || lower.includes("schema cache"))) {
    return true;
  }
  return lower.includes("schema cache") && lower.includes(col.split("_")[0] ?? col);
}
