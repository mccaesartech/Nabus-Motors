import "server-only";

import { NextResponse } from "next/server";
import { auditHttpStatusResponse } from "@/lib/audit/http-status";
import { databaseAppError, type SupabaseLikeError } from "./db-errors";
import { AppError, isAppError, kindForStatus } from "./kinds";
import { logAppError, toAppError, type ErrorActor } from "./logger";

/**
 * The single failure shape for every API route.
 *
 * `ok` is kept because existing clients branch on it; `success` and `errorId`
 * are additive. No internal detail is ever included.
 */
export type ApiFailureBody = {
  ok: false;
  success: false;
  message: string;
  errorId: string;
  /** Optional machine-readable hint already used by some clients. */
  code?: string;
};

export type FailureOptions = {
  /** Dotted module path, e.g. `api.admin.vehicles.PATCH`. */
  module: string;
  /** Domain sentence to show when nothing more specific was derived. */
  message?: string;
  request?: Request | null;
  requestBody?: unknown;
  actor?: ErrorActor | null;
  /** Extra JSON merged into the response — must be user-safe. */
  extra?: Record<string, unknown>;
  /** Additional structured detail for the log record only. */
  context?: Record<string, unknown>;
  /** Force a status instead of the one derived from the error kind. */
  status?: number;
};

function respond(appError: AppError, options: FailureOptions): NextResponse {
  const status = options.status ?? appError.status;

  const errorId = logAppError({
    error: appError,
    module: options.module,
    userMessage: appError.userMessage,
    kind: appError.kind,
    status,
    request: options.request ?? null,
    requestBody: options.requestBody,
    actor: options.actor ?? null,
    dbCode: appError.dbCode,
    context: options.context,
  });

  try {
    auditHttpStatusResponse({
      status,
      module: options.module,
      request: options.request ?? null,
      actorId: options.actor?.id ?? null,
      actorRole: options.actor?.role ?? null,
      message: appError.userMessage,
    });
  } catch {
    // Audit must never break API failure responses.
  }

  const body: ApiFailureBody & Record<string, unknown> = {
    ok: false,
    success: false,
    message: appError.userMessage,
    errorId,
    ...(options.extra ?? {}),
  };

  return NextResponse.json(body, { status });
}

/** Failure from an already-typed AppError, or any thrown value. */
export function apiFailure(error: unknown, options: FailureOptions): NextResponse {
  return respond(toAppError(error, options.message), options);
}

/**
 * Failure from a Supabase/Postgres error. `options.message` is the domain
 * fallback used when the error could not be mapped to something specific.
 */
export function dbFailure(
  error: SupabaseLikeError | null | undefined,
  options: FailureOptions
): NextResponse {
  return respond(databaseAppError(error, options.message), options);
}

/** Failure from an external provider (email, WhatsApp, AI, storage CDN). */
export function externalFailure(error: unknown, options: FailureOptions): NextResponse {
  const appError = isAppError(error)
    ? error
    : new AppError("external_service", { message: options.message, cause: error });
  return respond(appError, options);
}

/**
 * Wrap a route handler so an unhandled throw becomes a logged, friendly 500
 * instead of a Next.js stack page. Handlers keep their own explicit returns.
 */
export function withApiErrorHandling<Args extends unknown[]>(
  module: string,
  handler: (...args: Args) => Promise<Response> | Response,
  fallbackMessage?: string
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      const request = args[0] instanceof Request ? (args[0] as Request) : null;
      return apiFailure(error, { module, message: fallbackMessage, request });
    }
  };
}

/** Build a failure body without a NextResponse (streaming / custom responses). */
export function failureBody(error: unknown, options: FailureOptions): ApiFailureBody {
  const appError = toAppError(error, options.message);
  const errorId = logAppError({
    error: appError,
    module: options.module,
    userMessage: appError.userMessage,
    kind: appError.kind,
    status: options.status ?? appError.status,
    request: options.request ?? null,
    requestBody: options.requestBody,
    actor: options.actor ?? null,
    dbCode: appError.dbCode,
    context: options.context,
  });

  return { ok: false, success: false, message: appError.userMessage, errorId };
}

export { kindForStatus };
