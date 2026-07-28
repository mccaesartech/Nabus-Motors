/**
 * Client-side consumption of the standard API failure shape.
 *
 * Client code should never render a caught exception's `message` directly —
 * it can be a Supabase string echoed through a `throw new Error(json.message)`,
 * a DOM exception, or a bundler chunk error. Route everything through here.
 */

import { isErrorId } from "./error-id";

export type ApiFailureLike = {
  ok?: boolean;
  success?: boolean;
  message?: unknown;
  errorId?: unknown;
  warning?: unknown;
};

export type FriendlyError = {
  /** Safe sentence to render. */
  message: string;
  /** `TG-XXXXXX` when the server supplied one. */
  errorId: string | null;
  /** `message` plus a support reference, for a single-line banner. */
  display: string;
};

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";
export const OFFLINE_ERROR_MESSAGE =
  "You appear to be offline. Check your connection and try again.";
export const TIMEOUT_ERROR_MESSAGE = "That took too long. Please try again.";

/** Anything longer than this is almost certainly a raw server/database string. */
const MAX_TRUSTED_MESSAGE_LENGTH = 300;

// Deliberately narrow: several intentional admin hints mention Supabase and
// migration filenames, and those must survive. Only unmistakably internal
// fragments are rejected.
const RAW_MESSAGE_MARKERS = [
  "pgrst",
  "sqlstate",
  "violates",
  "duplicate key",
  'relation "',
  'column "',
  "syntax error at",
  "at async",
  "<!doctype",
  "<html",
  "econnrefused",
  "econnreset",
  "enotfound",
  "typeerror:",
  "referenceerror:",
];

/** Reject strings that look like leaked internals even if a route missed the helper. */
function looksSafe(message: string): boolean {
  if (!message || message.length > MAX_TRUSTED_MESSAGE_LENGTH) return false;
  const lower = message.toLowerCase();
  return !RAW_MESSAGE_MARKERS.some((marker) => lower.includes(marker));
}

export function formatErrorReference(errorId: string | null | undefined): string | null {
  return isErrorId(errorId) ? `Reference ${errorId}` : null;
}

function withReference(message: string, errorId: string | null): string {
  const reference = formatErrorReference(errorId);
  return reference ? `${message} (${reference})` : message;
}

/** Read a parsed API failure body into something safe to render. */
export function describeApiFailure(
  json: ApiFailureLike | null | undefined,
  fallback = GENERIC_ERROR_MESSAGE
): FriendlyError {
  const errorId = isErrorId(json?.errorId) ? (json!.errorId as string) : null;
  const raw = typeof json?.message === "string" ? json.message.trim() : "";
  const warning = typeof json?.warning === "string" ? json.warning.trim() : "";

  const safeWarning = looksSafe(warning) ? warning : "";
  let message = looksSafe(raw) ? raw : safeWarning || fallback;
  if (safeWarning && safeWarning !== message) {
    message = `${message} ${safeWarning}`;
  }

  return { message, errorId, display: withReference(message, errorId) };
}

/**
 * Describe a caught exception from a fetch/handler block. Recognizes offline,
 * abort/timeout, and chunk-load failures; everything else becomes generic.
 */
export function friendlyClientError(
  error: unknown,
  fallback = GENERIC_ERROR_MESSAGE
): FriendlyError {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { message: OFFLINE_ERROR_MESSAGE, errorId: null, display: OFFLINE_ERROR_MESSAGE };
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return { message: TIMEOUT_ERROR_MESSAGE, errorId: null, display: TIMEOUT_ERROR_MESSAGE };
  }

  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("timed out") || lower.includes("timeout")) {
      return { message: TIMEOUT_ERROR_MESSAGE, errorId: null, display: TIMEOUT_ERROR_MESSAGE };
    }
    if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
      return { message: OFFLINE_ERROR_MESSAGE, errorId: null, display: OFFLINE_ERROR_MESSAGE };
    }
    if (looksSafe(error.message)) {
      return { message: error.message, errorId: null, display: error.message };
    }
  }

  return { message: fallback, errorId: null, display: fallback };
}

/** Shorthand for `catch` blocks that only need a string for component state. */
export function friendlyErrorMessage(error: unknown, fallback = GENERIC_ERROR_MESSAGE): string {
  return friendlyClientError(error, fallback).display;
}
