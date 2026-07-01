/** Client-safe custom vehicle request reference format (server assigns via DB when possible). */
export function generateCustomRequestReferenceCode(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CR-${y}${m}${d}-${suffix}`;
}

export function isCustomRequestReferenceCode(value: string): boolean {
  return /^CR-\d{8}-[A-Z0-9]{4}$/i.test(value.trim());
}
