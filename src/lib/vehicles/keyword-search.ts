import { quotePostgrestFilterValue } from "@/lib/security/postgrest-filter";
import {
  matchesSmartQuery,
  tokenizeQuery,
} from "@/lib/admin/search-ranking";
import type { Vehicle } from "@/lib/types";

export const MAX_PUBLIC_SEARCH_LENGTH = 100;

const KEYWORD_COLUMNS = [
  "make",
  "model",
  "trim",
  "slug",
  "color",
  "location",
  "body_type",
  "vin",
] as const;

function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function ilikeContainsPattern(token: string): string {
  return `%${escapeIlike(token.trim())}%`;
}

/** PostgREST OR filter: token matches any searchable vehicle column (or exact year). */
export function buildVehicleKeywordOrFilter(token: string): string {
  const pattern = quotePostgrestFilterValue(ilikeContainsPattern(token));
  const parts = KEYWORD_COLUMNS.map((col) => `${col}.ilike.${pattern}`);
  const yearToken = token.trim();
  if (/^\d{4}$/.test(yearToken)) {
    parts.push(`year.eq.${yearToken}`);
  }
  return parts.join(",");
}

export function sanitizePublicSearchQuery(query: string | undefined): string | undefined {
  if (!query) return undefined;
  const trimmed = query.trim().slice(0, MAX_PUBLIC_SEARCH_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Apply multi-token keyword AND (each token must match at least one column). */
export function applyKeywordFilterToQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  q: string | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const sanitized = sanitizePublicSearchQuery(q);
  if (!sanitized) return query;

  const tokens = tokenizeQuery(sanitized);
  if (tokens.length === 0) return query;

  let next = query;
  for (const token of tokens) {
    next = next.or(buildVehicleKeywordOrFilter(token));
  }
  return next;
}

export function vehicleMatchesKeyword(
  vehicle: Vehicle,
  query: string | undefined
): boolean {
  const sanitized = sanitizePublicSearchQuery(query);
  if (!sanitized) return true;

  const haystack = [
    vehicle.year,
    vehicle.make,
    vehicle.model,
    vehicle.trim ?? "",
    vehicle.slug,
    vehicle.vin,
    vehicle.color,
    vehicle.bodyType,
    vehicle.transmission,
    vehicle.fuelType,
    vehicle.location,
  ].join(" ");

  return matchesSmartQuery(haystack, sanitized, [
    { value: vehicle.vin, kind: "vin", weight: 1.5 },
    { value: vehicle.slug, kind: "sku", weight: 1.3 },
    { value: vehicle.color, kind: "text" },
    { value: vehicle.year, kind: "year" },
  ]);
}
