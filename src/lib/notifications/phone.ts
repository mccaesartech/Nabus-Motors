/** Ghana mobile prefixes after country code 233. */
const GHANA_MOBILE_PREFIXES = new Set([
  "20",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "50",
  "53",
  "54",
  "55",
  "56",
  "57",
  "59",
]);

/** Normalize phone to E.164 digits (no +) for WhatsApp APIs. */
export function normalizePhoneDigits(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 10) {
    digits = `233${digits.slice(1)}`;
  }
  // Ghana mobile without leading 0, e.g. 244876784
  if (digits.length === 9 && GHANA_MOBILE_PREFIXES.has(digits.slice(0, 2))) {
    digits = `233${digits}`;
  }
  return digits;
}

/** True when the number looks like a Ghana mobile (WhatsApp-capable). */
export function isGhanaMobile(phone: string): boolean {
  const digits = normalizePhoneDigits(phone);
  if (!digits.startsWith("233") || digits.length < 12) return false;
  const local = digits.slice(3, 5);
  return GHANA_MOBILE_PREFIXES.has(local);
}

/** Default checkbox state: checked for Ghana mobile numbers. */
export function defaultWhatsAppOptIn(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed) return false;
  return isGhanaMobile(trimmed);
}

export function toWhatsAppE164(phone: string): string {
  const digits = normalizePhoneDigits(phone);
  return digits ? `+${digits}` : "";
}

export function toWaMeNumber(phone: string): string {
  return normalizePhoneDigits(phone);
}
