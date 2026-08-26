const ISO_4217_RE = /^[A-Z]{3}$/;

export function normalizeCurrencyCode(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function isValidCurrencyCode(value: string | null | undefined): boolean {
  return ISO_4217_RE.test(normalizeCurrencyCode(value));
}

export function assertCurrencyCode(value: string | null | undefined): string {
  const code = normalizeCurrencyCode(value);
  if (!ISO_4217_RE.test(code)) {
    throw new ConversionCodeError(
      value ? `Invalid currency code "${String(value).slice(0, 12)}".` : "Currency code is required."
    );
  }
  return code;
}

export class ConversionCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversionCodeError";
  }
}
