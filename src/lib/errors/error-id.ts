/**
 * Support-facing error correlation IDs.
 *
 * Format: `TG-XXXXXX` using a Crockford-style alphabet with I/L/O/U removed so
 * an ID read aloud over WhatsApp cannot be mistyped. Safe on both runtimes.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ID_LENGTH = 6;

export const ERROR_ID_PATTERN = /^TG-[0-9A-HJKMNP-TV-Z]{6}$/;

export function newErrorId(): string {
  const bytes = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(bytes);

  let out = "";
  for (const byte of bytes) {
    out += ALPHABET[byte % ALPHABET.length];
  }
  return `TG-${out}`;
}

export function isErrorId(value: unknown): value is string {
  return typeof value === "string" && ERROR_ID_PATTERN.test(value);
}

/** Normalize free-text search input (`tg-7k3qp2`) to the stored form. */
export function normalizeErrorId(value: string): string {
  const trimmed = value.trim().toUpperCase();
  if (ERROR_ID_PATTERN.test(trimmed)) return trimmed;
  const bare = trimmed.replace(/^TG-?/, "");
  return `TG-${bare}`;
}
