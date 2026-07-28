/**
 * Supabase / Postgres error → AppError translation.
 *
 * Order of precedence:
 *   1. `friendlyAdminDbError` — existing hand-written operational hints
 *      (missing migrations, service-role key, known constraints). Kept first so
 *      the actionable admin guidance built up over time is not lost.
 *   2. Constraint-name map — deterministic, does not depend on wording.
 *   3. SQLSTATE / PostgREST code map.
 *   4. Generic message for the kind. The raw text is never returned.
 */

import { friendlyAdminDbError } from "@/lib/admin/api-errors";
import { AppError, type AppErrorKind } from "./kinds";

export type SupabaseLikeError = {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

type Mapped = { kind: AppErrorKind; message: string };

/** Constraint name → friendly sentence. Checked against message + details. */
const CONSTRAINT_MESSAGES: Array<{ match: string; kind: AppErrorKind; message: string }> = [
  {
    match: "vehicles_local_shipment_exclusive",
    kind: "conflict",
    message:
      "Locally available stock cannot also be marked for shipment. Turn off “Shipment available” or “Available locally”, then save again.",
  },
  {
    match: "vehicles_vin_key",
    kind: "conflict",
    message: "Another vehicle already uses this VIN. Leave the VIN blank or enter a unique one.",
  },
  {
    match: "vehicles_slug_key",
    kind: "conflict",
    message:
      "A vehicle with the same year, make, and model already exists. Add a trim or edit the existing listing.",
  },
  {
    match: "vehicles_status_check",
    kind: "validation",
    message: "Invalid status. Choose Available, Pre-Order, Reserved, or Sold.",
  },
  {
    match: "vehicles_country_of_origin_check",
    kind: "validation",
    message: "Invalid country of origin. Choose Ghana, China, Japan, Other, or Not specified.",
  },
  {
    match: "platform_users_email_key",
    kind: "conflict",
    message: "A team member with this email already exists.",
  },
  {
    match: "customers_email_key",
    kind: "conflict",
    message: "An account with this email already exists.",
  },
  {
    match: "site_content_section_key",
    kind: "conflict",
    message: "That website section was updated by someone else. Reload the page and save again.",
  },
];

/** SQLSTATE / PostgREST code → kind + friendly sentence. */
const CODE_MESSAGES: Record<string, Mapped> = {
  // Integrity
  "23505": { kind: "conflict", message: "That record already exists. Change the duplicated value and try again." },
  "23503": {
    kind: "conflict",
    message: "This item is still linked to other records, so it cannot be changed or removed yet.",
  },
  "23514": { kind: "validation", message: "Some values are not allowed together. Review the form and try again." },
  "23502": { kind: "validation", message: "A required field is missing. Fill in every required field and try again." },
  "22001": { kind: "validation", message: "One of the values is too long. Shorten it and try again." },
  "22003": { kind: "validation", message: "A number is out of the allowed range." },
  "22P02": { kind: "validation", message: "One of the values is in the wrong format." },
  // Access / schema
  "42501": { kind: "forbidden", message: "The server is not allowed to perform this database operation." },
  "42703": {
    kind: "unavailable",
    message: "The database is missing a column this feature needs. Run the pending Supabase migration, then try again.",
  },
  "42P01": {
    kind: "unavailable",
    message: "The database is missing a table this feature needs. Run the pending Supabase migration, then try again.",
  },
  // Availability
  "40001": { kind: "conflict", message: "Someone else saved at the same time. Try again." },
  "40P01": { kind: "conflict", message: "The database was busy. Try again." },
  "53300": { kind: "unavailable", message: "The database is at capacity right now. Try again shortly." },
  "57014": { kind: "unavailable", message: "That request took too long and was cancelled. Try again." },
  "08000": { kind: "unavailable", message: "We lost the connection to the database. Try again shortly." },
  "08006": { kind: "unavailable", message: "We lost the connection to the database. Try again shortly." },
  // PostgREST
  PGRST116: { kind: "not_found", message: "That record no longer exists, or it was already updated." },
  PGRST301: { kind: "unauthorized", message: "Your session has expired. Please sign in again." },
  PGRST204: {
    kind: "unavailable",
    message: "The database schema is out of date for this feature. Run the pending Supabase migration, then try again.",
  },
};

const TIMEOUT_HINTS = ["timeout", "timed out", "etimedout", "aborted", "econnreset", "fetch failed", "socket hang up"];

function normalize(error: SupabaseLikeError | null | undefined): {
  raw: string;
  code: string | null;
  haystack: string;
} {
  const raw = error?.message?.trim() ?? "";
  const code = error?.code?.trim() || null;
  const haystack = [raw, error?.details ?? "", error?.hint ?? ""].join(" ").toLowerCase();
  return { raw, code, haystack };
}

/**
 * Translate a Supabase/Postgres error into a user-safe message + kind.
 * `fallback` is the domain sentence to use when nothing more specific matched.
 */
export function mapDatabaseError(
  error: SupabaseLikeError | null | undefined,
  fallback?: string
): Mapped {
  const { raw, code, haystack } = normalize(error);

  const constraint = CONSTRAINT_MESSAGES.find((entry) => haystack.includes(entry.match));

  // 1. Existing operational hints. `friendlyAdminDbError` returns its input
  //    unchanged when no rule matched, so an identical result means "no match".
  //    The hint supplies the wording; the constraint or SQLSTATE still decides
  //    the kind so the HTTP status stays correct.
  if (raw) {
    const hinted = friendlyAdminDbError(raw);
    if (hinted !== raw) {
      const byCode = code ? CODE_MESSAGES[code] : undefined;
      return {
        kind: constraint?.kind ?? byCode?.kind ?? kindForHintedMessage(hinted),
        message: hinted,
      };
    }
  }

  // 2. Constraint names are stable across Postgres versions and wording.
  if (constraint) {
    return { kind: constraint.kind, message: constraint.message };
  }

  // 3. SQLSTATE / PostgREST codes.
  if (code && CODE_MESSAGES[code]) {
    return CODE_MESSAGES[code];
  }

  // 4. Connection/timeout wording when no code was supplied.
  if (TIMEOUT_HINTS.some((hint) => haystack.includes(hint))) {
    return {
      kind: "unavailable",
      message: "The request took too long or the connection dropped. Try again.",
    };
  }

  if (haystack.includes("invalid api key") || haystack.includes("jwt")) {
    return {
      kind: "unavailable",
      message: "The server could not authenticate with the database. Contact your administrator.",
    };
  }

  return {
    kind: "database",
    message: fallback?.trim() || "We could not complete that request. Please try again.",
  };
}

/** Hinted messages are operational guidance — classify by their own wording. */
function kindForHintedMessage(message: string): AppErrorKind {
  const lower = message.toLowerCase();
  if (lower.includes("run ") && (lower.includes(".sql") || lower.includes("migration"))) {
    return "unavailable";
  }
  if (lower.includes("cannot also") || lower.includes("already uses")) return "conflict";
  if (lower.includes("invalid ")) return "validation";
  if (lower.includes("supabase_service_role_key")) return "unavailable";
  return "database";
}

/** Build an AppError from a Supabase error, preserving the code for logging. */
export function databaseAppError(
  error: SupabaseLikeError | null | undefined,
  fallback?: string
): AppError {
  const mapped = mapDatabaseError(error, fallback);
  return new AppError(mapped.kind, {
    message: mapped.message,
    cause: error,
    dbCode: error?.code ?? null,
  });
}
