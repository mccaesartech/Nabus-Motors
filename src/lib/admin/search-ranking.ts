/** Smart admin search matching & ranking (exact/prefix > contains > light fuzzy). */

const MIN_FUZZY_TOKEN_LEN = 4;
const MAX_EDIT_DISTANCE = 1;

export type SearchFieldKind = "text" | "id" | "vin" | "sku" | "phone" | "email" | "year";

export type SearchField = {
  value: string | number | null | undefined;
  kind?: SearchFieldKind;
  /** Relative importance within a record (default 1). */
  weight?: number;
};

export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Strip separators so VINs / stock codes compare consistently. */
export function normalizeVin(value: string): string {
  return value.replace(/[\s\-_.]/g, "").toUpperCase();
}

export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function tokenizeQuery(query: string): string[] {
  return normalizeSearchText(query)
    .split(/[\s,/|]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Damerau–Levenshtein so adjacent letter swaps count as one edit. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const da = new Map<string, number>();
  const maxdist = a.length + b.length;
  const d: number[][] = Array.from({ length: a.length + 2 }, () =>
    Array<number>(b.length + 2).fill(0)
  );
  d[0][0] = maxdist;
  for (let i = 0; i <= a.length; i++) {
    d[i + 1][0] = maxdist;
    d[i + 1][1] = i;
  }
  for (let j = 0; j <= b.length; j++) {
    d[0][j + 1] = maxdist;
    d[1][j + 1] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    let db = 0;
    for (let j = 1; j <= b.length; j++) {
      const i1 = da.get(b[j - 1]) ?? 0;
      const j1 = db;
      let cost = 1;
      if (a[i - 1] === b[j - 1]) {
        cost = 0;
        db = j;
      }
      d[i + 1][j + 1] = Math.min(
        d[i][j] + cost,
        d[i + 1][j] + 1,
        d[i][j + 1] + 1,
        d[i1][j1] + (i - i1 - 1) + 1 + (j - j1 - 1)
      );
    }
    da.set(a[i - 1], i);
  }

  return d[a.length + 1][b.length + 1];
}

function fieldString(field: SearchField): string {
  if (field.value == null) return "";
  return String(field.value).trim();
}

function comparableField(field: SearchField): string {
  const raw = fieldString(field);
  if (!raw) return "";
  switch (field.kind) {
    case "vin":
    case "sku":
    case "id":
      return normalizeVin(raw).toLowerCase();
    case "phone":
      return normalizePhoneDigits(raw);
    case "email":
      return raw.toLowerCase();
    case "year":
      return String(field.value);
    default:
      return normalizeSearchText(raw);
  }
}

function comparableQuery(query: string, kind: SearchFieldKind = "text"): string {
  const trimmed = query.trim();
  if (!trimmed) return "";
  switch (kind) {
    case "vin":
    case "sku":
    case "id":
      return normalizeVin(trimmed).toLowerCase();
    case "phone":
      return normalizePhoneDigits(trimmed);
    case "email":
      return trimmed.toLowerCase();
    case "year":
      return trimmed;
    default:
      return normalizeSearchText(trimmed);
  }
}

/**
 * Score how well a single field matches the query.
 * Higher is better. Returns 0 for no useful match.
 */
export function scoreFieldMatch(field: SearchField, query: string): number {
  const kind = field.kind ?? "text";
  const weight = field.weight ?? 1;
  const fieldCmp = comparableField(field);
  const queryCmp = comparableQuery(query, kind);
  if (!fieldCmp || !queryCmp) return 0;

  let base = 0;

  if (kind === "phone") {
    if (fieldCmp === queryCmp) base = 1000;
    else if (queryCmp.length >= 4 && (fieldCmp.endsWith(queryCmp) || fieldCmp.includes(queryCmp))) {
      base = queryCmp.length >= 7 ? 850 : 500;
    }
  } else if (fieldCmp === queryCmp) {
    base = kind === "id" || kind === "vin" || kind === "sku" ? 1200 : 900;
  } else if (fieldCmp.startsWith(queryCmp)) {
    base = kind === "id" || kind === "vin" || kind === "sku" ? 950 : 650;
  } else if (fieldCmp.includes(queryCmp)) {
    base = kind === "id" || kind === "vin" || kind === "sku" ? 700 : 280;
  } else if (
    queryCmp.length >= MIN_FUZZY_TOKEN_LEN &&
    fieldCmp.length >= MIN_FUZZY_TOKEN_LEN &&
    Math.abs(fieldCmp.length - queryCmp.length) <= MAX_EDIT_DISTANCE &&
    editDistance(fieldCmp, queryCmp) <= MAX_EDIT_DISTANCE
  ) {
    // Whole-field typo tolerance only — avoids junk substring fuzz.
    base = 90;
  } else if (kind === "text") {
    // Token-level fuzzy against words in the field (e.g. "Toytoa" → "Toyota").
    const words = fieldCmp.split(" ").filter(Boolean);
    for (const word of words) {
      if (word.length < MIN_FUZZY_TOKEN_LEN) continue;
      if (Math.abs(word.length - queryCmp.length) > MAX_EDIT_DISTANCE) continue;
      if (editDistance(word, queryCmp) <= MAX_EDIT_DISTANCE) {
        base = Math.max(base, 70);
      }
    }
  }

  return base * weight;
}

/**
 * Score a record against a query using weighted fields.
 * Multi-token queries require every token to match at least one field
 * (or the full phrase to match) so loose fuzzy does not return junk.
 */
export function scoreSearchRecord(fields: SearchField[], query: string): number {
  const trimmed = query.trim();
  if (!trimmed) return 0;

  const tokens = tokenizeQuery(trimmed);
  if (tokens.length === 0) return 0;

  // Full-phrase score across fields.
  let bestPhrase = 0;
  for (const field of fields) {
    bestPhrase = Math.max(bestPhrase, scoreFieldMatch(field, trimmed));
  }

  if (tokens.length === 1) {
    return bestPhrase;
  }

  // Multi-token: each token must hit something; sum best per-token scores.
  let tokenTotal = 0;
  for (const token of tokens) {
    let bestForToken = 0;
    for (const field of fields) {
      bestForToken = Math.max(bestForToken, scoreFieldMatch(field, token));
    }
    if (bestForToken <= 0) {
      // Allow full-phrase match to rescue (e.g. "BMW X5" in one title field).
      return bestPhrase > 0 ? bestPhrase : 0;
    }
    tokenTotal += bestForToken;
  }

  // Prefer phrase exactness when both apply.
  return Math.max(bestPhrase, Math.round(tokenTotal / tokens.length) + tokens.length * 40);
}

/** True when the record is a useful match (not junk fuzzy noise). */
export function isStrongSearchMatch(fields: SearchField[], query: string): boolean {
  return scoreSearchRecord(fields, query) >= 70;
}

/**
 * Client/server shared matcher for local filters (inventory, leads, fallback).
 * Supports multi-token AND, VIN/phone normalization, and light typo tolerance.
 */
export function matchesSmartQuery(
  haystack: string,
  query: string,
  extraFields: SearchField[] = []
): boolean {
  const fields: SearchField[] = [
    { value: haystack, kind: "text", weight: 1 },
    ...extraFields,
  ];
  return isStrongSearchMatch(fields, query);
}

export function rankByScore<T extends { score: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.score - a.score);
}

/** Detect UUID-like or short opaque IDs for exact lookup boosts. */
export function looksLikeIdQuery(query: string): boolean {
  const q = query.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(q)) {
    return true;
  }
  // Short hex / alphanumeric refs (registration, reference codes).
  if (/^[A-Z0-9][A-Z0-9\-_]{4,31}$/i.test(q) && !/\s/.test(q)) {
    return true;
  }
  return false;
}

export function looksLikeVinQuery(query: string): boolean {
  const vin = normalizeVin(query);
  return /^[A-HJ-NPR-Z0-9]{8,17}$/i.test(vin);
}

export function looksLikeYearQuery(query: string): boolean {
  return /^\d{4}$/.test(query.trim());
}
