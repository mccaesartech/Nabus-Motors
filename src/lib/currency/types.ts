/** ISO 4217 currency code (e.g. GHS, USD, EUR). */
export type CurrencyCode = string;

/** Base currency for stored vehicle prices */
export const BASE_CURRENCY = "USD" as const;

/** Default display currency for site visitors */
export const DEFAULT_DISPLAY_CURRENCY = "GHS" as const;

/** Alternate currencies shown on vehicle detail price sections */
export const REFERENCE_CURRENCIES: readonly string[] = [
  "GHS",
  "USD",
  "EUR",
  "GBP",
  "NGN",
  "ZAR",
  "KES",
] as const;
