/** Client-safe freight quote reference format (server assigns via DB when possible). */
export function generateFreightReferenceCode(): string {
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `FQ-${year}-${suffix}`;
}

export function isFreightReferenceCode(value: string): boolean {
  return /^FQ-\d{4}-[A-Z0-9]{6}$/i.test(value.trim());
}
