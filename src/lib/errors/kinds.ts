/**
 * Typed application errors.
 *
 * Every failure that reaches a user is reduced to one of these kinds. The kind
 * decides the HTTP status and the default user-facing sentence; the original
 * cause never leaves the server.
 */

export const APP_ERROR_KINDS = [
  "validation",
  "not_found",
  "unauthorized",
  "forbidden",
  "conflict",
  "rate_limit",
  "external_service",
  "database",
  "unavailable",
  "unknown",
] as const;

export type AppErrorKind = (typeof APP_ERROR_KINDS)[number];

export type ErrorSeverity = "low" | "medium" | "high" | "critical";

const STATUS_BY_KIND: Record<AppErrorKind, number> = {
  validation: 400,
  not_found: 404,
  unauthorized: 401,
  forbidden: 403,
  conflict: 409,
  rate_limit: 429,
  external_service: 502,
  database: 500,
  unavailable: 503,
  unknown: 500,
};

const MESSAGE_BY_KIND: Record<AppErrorKind, string> = {
  validation: "Some of the details you entered are not valid. Check the highlighted fields and try again.",
  not_found: "We could not find what you were looking for. It may have been moved or removed.",
  unauthorized: "Your session has expired. Please sign in again.",
  forbidden: "You do not have permission to perform this action.",
  conflict: "That change conflicts with existing data. Review the details and try again.",
  rate_limit: "Too many requests. Please wait a moment and try again.",
  external_service: "An external service is not responding right now. Please try again shortly.",
  database: "We could not complete that request. Please try again.",
  unavailable: "This feature is temporarily unavailable. Please try again shortly.",
  unknown: "Something went wrong on our side. Please try again.",
};

const SEVERITY_BY_KIND: Record<AppErrorKind, ErrorSeverity> = {
  validation: "low",
  not_found: "low",
  unauthorized: "low",
  forbidden: "medium",
  conflict: "medium",
  rate_limit: "medium",
  external_service: "high",
  database: "high",
  unavailable: "high",
  unknown: "critical",
};

export function statusForKind(kind: AppErrorKind): number {
  return STATUS_BY_KIND[kind] ?? 500;
}

export function defaultMessageForKind(kind: AppErrorKind): string {
  return MESSAGE_BY_KIND[kind] ?? MESSAGE_BY_KIND.unknown;
}

export function severityForKind(kind: AppErrorKind): ErrorSeverity {
  return SEVERITY_BY_KIND[kind] ?? "high";
}

export type AppErrorOptions = {
  /** Overrides the kind default. Must already be safe to show a user. */
  message?: string;
  /** Overrides the kind default status. */
  status?: number;
  /** Original throwable / Supabase error — logged, never returned. */
  cause?: unknown;
  /** Postgres or PostgREST code when the failure came from the database. */
  dbCode?: string | null;
  /** Extra structured context for the log record only. */
  context?: Record<string, unknown>;
};

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly status: number;
  readonly userMessage: string;
  readonly dbCode: string | null;
  readonly context: Record<string, unknown>;

  constructor(kind: AppErrorKind, options: AppErrorOptions = {}) {
    const userMessage = options.message?.trim() || defaultMessageForKind(kind);
    super(userMessage, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.kind = kind;
    this.status = options.status ?? statusForKind(kind);
    this.userMessage = userMessage;
    this.dbCode = options.dbCode ?? null;
    this.context = options.context ?? {};
  }

  get severity(): ErrorSeverity {
    return severityForKind(this.kind);
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/** Convenience constructors — mirror the naming used in the audit. */
export const ValidationError = (message?: string, options: AppErrorOptions = {}) =>
  new AppError("validation", { ...options, message });
export const NotFoundError = (message?: string, options: AppErrorOptions = {}) =>
  new AppError("not_found", { ...options, message });
export const UnauthorizedError = (message?: string, options: AppErrorOptions = {}) =>
  new AppError("unauthorized", { ...options, message });
export const ForbiddenError = (message?: string, options: AppErrorOptions = {}) =>
  new AppError("forbidden", { ...options, message });
export const ConflictError = (message?: string, options: AppErrorOptions = {}) =>
  new AppError("conflict", { ...options, message });
export const RateLimitError = (message?: string, options: AppErrorOptions = {}) =>
  new AppError("rate_limit", { ...options, message });
export const ExternalServiceError = (message?: string, options: AppErrorOptions = {}) =>
  new AppError("external_service", { ...options, message });
export const DatabaseError = (message?: string, options: AppErrorOptions = {}) =>
  new AppError("database", { ...options, message });
export const UnavailableError = (message?: string, options: AppErrorOptions = {}) =>
  new AppError("unavailable", { ...options, message });
export const UnknownError = (message?: string, options: AppErrorOptions = {}) =>
  new AppError("unknown", { ...options, message });

/** Map an arbitrary status code back to a kind (used when wrapping fetch results). */
export function kindForStatus(status: number): AppErrorKind {
  switch (status) {
    case 400:
      return "validation";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 429:
      return "rate_limit";
    case 502:
    case 504:
      return "external_service";
    case 503:
      return "unavailable";
    default:
      return status >= 500 ? "unknown" : "validation";
  }
}
