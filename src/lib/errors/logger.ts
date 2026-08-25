import "server-only";

import * as Sentry from "@sentry/nextjs";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requestIp } from "@/lib/security/rate-limit";
import { newErrorId } from "./error-id";
import {
  AppError,
  isAppError,
  severityForKind,
  type AppErrorKind,
  type ErrorSeverity,
} from "./kinds";
import {
  describeUserAgent,
  sanitizeHeaders,
  sanitizeRequestBody,
  sanitizeStack,
  sanitizeUrl,
} from "./sanitize";
import {
  SCHEMA_CAPS,
  isMissingRelationError,
  isSchemaMissing,
  markSchemaMissing,
  markSchemaPresent,
} from "@/lib/observability/schema-capability";

export const ERROR_LOG_TABLE = "platform_error_log";

export type ErrorActor = {
  id?: string | null;
  role?: string | null;
  type?: string | null;
};

export type LogErrorInput = {
  /** Thrown value. Anything is accepted; only safe parts are recorded. */
  error: unknown;
  /** Dotted module path, e.g. `api.admin.vehicles.PATCH`. */
  module: string;
  /** The friendly sentence that was shown to the user. */
  userMessage: string;
  kind: AppErrorKind;
  status: number;
  request?: Request | null;
  /** Already-parsed request body, if the handler read one. */
  requestBody?: unknown;
  actor?: ErrorActor | null;
  dbCode?: string | null;
  context?: Record<string, unknown>;
};

export type ErrorLogRecord = {
  event: "app_error";
  errorId: string;
  timestamp: string;
  severity: ErrorSeverity;
  kind: AppErrorKind;
  status: number;
  module: string;
  method: string | null;
  route: string | null;
  userMessage: string;
  internalMessage: string | null;
  dbCode: string | null;
  actorId: string | null;
  actorRole: string | null;
  ip: string | null;
  browser: string | null;
  os: string | null;
  environment: string;
  release: string | null;
  stack: string | null;
  requestBody: Record<string, unknown> | null;
  headers: Record<string, string>;
  context: Record<string, unknown>;
};

/** Table-missing / permission failures must never break a request handler. */
let persistDisabled = false;

function internalMessageOf(error: unknown): string | null {
  if (isAppError(error)) {
    const cause = error.cause;
    if (cause && typeof cause === "object" && "message" in cause) {
      const message = (cause as { message?: unknown }).message;
      if (typeof message === "string") return message.slice(0, 2000);
    }
    return error.message.slice(0, 2000);
  }
  if (error instanceof Error) return error.message.slice(0, 2000);
  if (typeof error === "string") return error.slice(0, 2000);
  return null;
}

function stackOf(error: unknown): string | null {
  if (error instanceof Error) {
    const own = sanitizeStack(error.stack);
    const cause = error.cause;
    if (cause instanceof Error) {
      const causeStack = sanitizeStack(cause.stack, 6);
      if (causeStack) return `${own ?? ""}\nCaused by: ${causeStack}`.trim();
    }
    return own;
  }
  return null;
}

export function buildErrorLogRecord(input: LogErrorInput, errorId: string): ErrorLogRecord {
  const { error, module, userMessage, kind, status, request, actor } = input;
  const headers = request?.headers ?? null;
  const agent = describeUserAgent(headers?.get("user-agent"));

  return {
    event: "app_error",
    errorId,
    timestamp: new Date().toISOString(),
    severity: severityForKind(kind),
    kind,
    status,
    module,
    method: request?.method ?? null,
    route: request?.url ? sanitizeUrl(request.url) : null,
    userMessage,
    internalMessage: internalMessageOf(error),
    dbCode: input.dbCode ?? (isAppError(error) ? error.dbCode : null),
    actorId: actor?.id ?? null,
    actorRole: actor?.role ?? null,
    ip: headers ? requestIp(headers) : null,
    browser: agent.browser,
    os: agent.os,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    release:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
      process.env.NEXT_PUBLIC_BUILD_ID ??
      null,
    stack: stackOf(error),
    requestBody: sanitizeRequestBody(input.requestBody),
    headers: sanitizeHeaders(headers),
    context: {
      ...(isAppError(error) ? error.context : {}),
      ...(input.context ?? {}),
    },
  };
}

function toRow(record: ErrorLogRecord) {
  return {
    error_id: record.errorId,
    severity: record.severity,
    kind: record.kind,
    status: record.status,
    module: record.module,
    method: record.method,
    route: record.route,
    user_message: record.userMessage,
    internal_message: record.internalMessage,
    db_code: record.dbCode,
    actor_id: record.actorId,
    actor_role: record.actorRole,
    ip: record.ip,
    browser: record.browser,
    os: record.os,
    environment: record.environment,
    release: record.release,
    stack: record.stack,
    request_body: record.requestBody,
    context: record.context,
    created_at: record.timestamp,
  };
}

/**
 * Persist to `platform_error_log`. Best effort: if migration 084 has not been
 * run the first failure disables persistence for the lifetime of the instance
 * and everything continues on console-only logging.
 */
async function persist(record: ErrorLogRecord): Promise<void> {
  if (persistDisabled || isSchemaMissing(SCHEMA_CAPS.platformErrorLog)) return;

  const supabase = createAdminSupabase();
  if (!supabase) return;

  const { error } = await supabase.from(ERROR_LOG_TABLE).insert(toRow(record));
  if (!error) {
    markSchemaPresent(SCHEMA_CAPS.platformErrorLog);
    return;
  }

  const message = error.message?.toLowerCase() ?? "";
  const missingTable =
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    isMissingRelationError(error.message, ERROR_LOG_TABLE) ||
    message.includes("does not exist") ||
    message.includes("schema cache");

  if (missingTable) {
    persistDisabled = true;
    markSchemaMissing(SCHEMA_CAPS.platformErrorLog);
    console.warn(
      JSON.stringify({
        event: "error_log_persist_disabled",
        reason: "table_missing",
        table: ERROR_LOG_TABLE,
        migration: "084_platform_error_log.sql / 086_postgres_error_clearance.sql",
      })
    );
    return;
  }

  console.warn(
    JSON.stringify({
      event: "error_log_persist_failed",
      table: ERROR_LOG_TABLE,
      code: error.code ?? null,
    })
  );
}

function reportToSentry(record: ErrorLogRecord, error: unknown): void {
  const dsn = process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return;

  try {
    Sentry.withScope((scope) => {
      scope.setTag("error_id", record.errorId);
      scope.setTag("error_kind", record.kind);
      scope.setTag("error_module", record.module);
      scope.setLevel(record.severity === "low" ? "warning" : "error");
      scope.setContext("app_error", {
        errorId: record.errorId,
        module: record.module,
        route: record.route,
        status: record.status,
        dbCode: record.dbCode,
      });
      Sentry.captureException(error instanceof Error ? error : new Error(record.userMessage));
    });
  } catch {
    // Never let telemetry break a request.
  }
}

/**
 * Log a handled error and return its support ID.
 * Fire-and-forget persistence — callers do not await the database write.
 */
export function logAppError(input: LogErrorInput): string {
  const errorId = newErrorId();
  let record: ErrorLogRecord;

  try {
    record = buildErrorLogRecord(input, errorId);
  } catch {
    console.error(
      JSON.stringify({ event: "app_error", errorId, module: input.module, status: input.status })
    );
    return errorId;
  }

  console.error(JSON.stringify(record));
  reportToSentry(record, input.error);
  void persist(record).catch(() => {
    /* already reported inside persist */
  });

  return errorId;
}

/** Coerce any thrown value into an AppError without losing the original cause. */
export function toAppError(error: unknown, fallbackMessage?: string): AppError {
  if (isAppError(error)) return error;
  return new AppError("unknown", { message: fallbackMessage, cause: error });
}
