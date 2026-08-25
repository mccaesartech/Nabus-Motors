/**
 * Redact secrets from audit metadata before persistence.
 * Field names stay; values that look like credentials are replaced.
 */

export const AUDIT_REDACTED = "[redacted]";

const SECRET_KEY =
  /pass(word)?|secret|token|key|authorization|cookie|session|otp|pin|hash|credential|signature|challenge|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|bearer/i;

const MAX_DEPTH = 4;
const MAX_KEYS = 50;
const MAX_STRING = 500;

function redactValue(key: string, value: unknown, depth: number): unknown {
  if (SECRET_KEY.test(key)) return AUDIT_REDACTED;
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    if (value.length > MAX_STRING) return `${value.slice(0, MAX_STRING)}…`;
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) return `[array:${value.length}]`;
    return value.slice(0, 20).map((item, i) => redactValue(String(i), item, depth + 1));
  }

  if (typeof value === "object") {
    if (depth >= MAX_DEPTH) return "[object]";
    return redactAuditMetadata(value as Record<string, unknown>, depth + 1);
  }

  return `[${typeof value}]`;
}

/** Deep-clone metadata with secrets redacted. Safe for empty / non-object input. */
export function redactAuditMetadata(
  metadata: Record<string, unknown> | null | undefined,
  depth = 0
): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [key, value] of Object.entries(metadata)) {
    if (count >= MAX_KEYS) {
      out["…"] = `${Object.keys(metadata).length - MAX_KEYS} more fields`;
      break;
    }
    out[key] = redactValue(key, value, depth);
    count += 1;
  }
  return out;
}
