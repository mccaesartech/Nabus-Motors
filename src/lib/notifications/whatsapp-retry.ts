/** Pure WhatsApp retry helpers (safe for unit tests without server-only). */

export const WHATSAPP_MAX_RETRY_ATTEMPTS = 5;

/** Exponential backoff in minutes: 1, 5, 15, 60, 180 */
export function whatsappRetryBackoffMinutes(retryCount: number): number {
  const schedule = [1, 5, 15, 60, 180];
  const index = Math.max(0, Math.min(retryCount, schedule.length - 1));
  return schedule[index]!;
}

export function computeWhatsAppNextRetryAt(
  retryCount: number,
  from: Date = new Date()
): Date {
  const minutes = whatsappRetryBackoffMinutes(retryCount);
  return new Date(from.getTime() + minutes * 60_000);
}

export function shouldMarkWhatsAppUndeliverable(retryCount: number): boolean {
  return retryCount >= WHATSAPP_MAX_RETRY_ATTEMPTS;
}
