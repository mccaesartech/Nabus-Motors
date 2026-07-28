/**
 * Redaction helpers for error logs.
 *
 * Rule of thumb: log the *shape* of a payload, never its secrets. Field names
 * are always safe to keep; values are kept only for short, non-sensitive
 * scalars that make an incident reproducible (ids, statuses, flags).
 */

const SECRET_FIELD = /pass(word)?|secret|token|key|authorization|cookie|session|otp|pin|hash|credential|signature|challenge/i;
const CONTACT_FIELD = /email|phone|whatsapp|mobile|msisdn|address|contact/i;
const FREE_TEXT_FIELD = /message|body|note|notes|description|content|comment|feedback|reason/i;

const MAX_VALUE_LENGTH = 120;
const MAX_DEPTH = 3;
const MAX_KEYS = 40;

export const REDACTED = "[redacted]";

/** `owner@truegoshen.com` → `o***@truegoshen.com`. Enough to correlate, not to harvest. */
export function maskEmail(value: string): string {
  const at = value.indexOf("@");
  if (at <= 0) return REDACTED;
  return `${value[0]}***${value.slice(at)}`;
}

/** Keeps the last 3 digits so support can match a customer without storing the number. */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return REDACTED;
  return `***${digits.slice(-3)}`;
}

function sanitizeValue(key: string, value: unknown, depth: number): unknown {
  if (SECRET_FIELD.test(key)) return REDACTED;

  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    if (CONTACT_FIELD.test(key)) {
      return value.includes("@") ? maskEmail(value) : maskPhone(value);
    }
    if (FREE_TEXT_FIELD.test(key)) return `[text:${value.length}]`;
    return value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) return `[array:${value.length}]`;
    return value.slice(0, 5).map((item) => sanitizeValue(key, item, depth + 1));
  }

  if (typeof value === "object") {
    if (depth >= MAX_DEPTH) return "[object]";
    return sanitizeRecord(value as Record<string, unknown>, depth + 1);
  }

  return `[${typeof value}]`;
}

function sanitizeRecord(record: Record<string, unknown>, depth: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [key, value] of Object.entries(record)) {
    if (count >= MAX_KEYS) {
      out["…"] = `${Object.keys(record).length - MAX_KEYS} more fields`;
      break;
    }
    out[key] = sanitizeValue(key, value, depth);
    count += 1;
  }
  return out;
}

/** Redact an arbitrary request body for logging. Returns null for empty input. */
export function sanitizeRequestBody(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return sanitizeRecord(body as Record<string, unknown>, 0);
}

const LOGGED_HEADERS = ["content-type", "accept", "referer", "x-pathname", "x-vercel-id"];

export function sanitizeHeaders(headers: Headers | null | undefined): Record<string, string> {
  if (!headers) return {};
  const out: Record<string, string> = {};
  for (const name of LOGGED_HEADERS) {
    const value = headers.get(name);
    if (value) out[name] = value.slice(0, MAX_VALUE_LENGTH);
  }
  return out;
}

/** Drop query values that may carry tokens; keep parameter names. */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url, "http://local");
    const params = new URLSearchParams();
    for (const [key] of parsed.searchParams) {
      params.set(key, SECRET_FIELD.test(key) ? REDACTED : parsed.searchParams.get(key)!.slice(0, 40));
    }
    const query = params.toString();
    return query ? `${parsed.pathname}?${query}` : parsed.pathname;
  } catch {
    return url.split("?")[0]?.slice(0, 256) ?? "";
  }
}

/** Coarse browser/OS from a user-agent string — no fingerprinting detail. */
export function describeUserAgent(userAgent: string | null | undefined): {
  browser: string;
  os: string;
} {
  const ua = userAgent ?? "";
  if (!ua) return { browser: "unknown", os: "unknown" };

  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "other";

  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "other";

  return { browser, os };
}

/** Truncate a stack to the frames that matter, dropping absolute build paths. */
export function sanitizeStack(stack: string | undefined, maxFrames = 12): string | null {
  if (!stack) return null;
  return stack
    .split("\n")
    .slice(0, maxFrames)
    .map((line) => line.replace(/\(?[A-Za-z]:[\\/][^\s)]+[\\/]/g, "("))
    .join("\n")
    .slice(0, 4000);
}
