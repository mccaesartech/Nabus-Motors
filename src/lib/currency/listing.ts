import { BASE_CURRENCY, REFERENCE_CURRENCIES } from "./types";
import { convertFromUsd, getActiveRates } from "./rates";
import { formatUsdPrice } from "./format";

/** Currencies available when entering a vehicle list price. */
export const LISTING_PRICE_CURRENCIES: readonly string[] = [
  ...REFERENCE_CURRENCIES,
] as const;

export type VehiclePriceFields = {
  /** Canonical USD amount (DB `price`). */
  price: number;
  /** Currency the seller entered (DB `price_currency`). */
  priceCurrency?: string | null;
  /** Exact amount entered in priceCurrency (DB `listed_price`). */
  listedPrice?: number | null;
};

/** Convert an amount in `fromCurrency` into USD using active FX rates. */
export function convertToUsd(
  amount: number,
  fromCurrency: string,
  rates = getActiveRates()
): number {
  const code = (fromCurrency || BASE_CURRENCY).toUpperCase();
  if (code === BASE_CURRENCY) return amount;
  const rate = rates[code];
  if (!rate || rate <= 0) return amount;
  return amount / rate;
}

/** Convert between any two supported currencies via USD. */
export function convertBetweenCurrencies(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates = getActiveRates()
): number {
  const from = (fromCurrency || BASE_CURRENCY).toUpperCase();
  const to = (toCurrency || BASE_CURRENCY).toUpperCase();
  if (from === to) return amount;
  const usd = convertToUsd(amount, from, rates);
  return convertFromUsd(usd, to, rates);
}

export function resolveListingCurrency(
  priceCurrency?: string | null
): string {
  const code = (priceCurrency || BASE_CURRENCY).trim().toUpperCase();
  return code || BASE_CURRENCY;
}

/**
 * Amount to show in the admin price input for a stored vehicle.
 * Prefers exact `listedPrice` when present; otherwise converts USD → listing currency.
 */
export function listingAmountForForm(fields: VehiclePriceFields): number {
  const currency = resolveListingCurrency(fields.priceCurrency);
  if (
    fields.listedPrice != null &&
    Number.isFinite(fields.listedPrice) &&
    fields.listedPrice >= 0
  ) {
    return Math.round(fields.listedPrice);
  }
  return Math.round(convertFromUsd(fields.price || 0, currency));
}

/** Persist shape: USD canonical + listing metadata. */
export function toStoredVehiclePrice(
  listedAmount: number,
  priceCurrency: string
): { price: number; listed_price: number; price_currency: string } {
  const currency = resolveListingCurrency(priceCurrency);
  const listed = Math.round(Number(listedAmount) || 0);
  return {
    price: Math.round(convertToUsd(listed, currency)),
    listed_price: listed,
    price_currency: currency,
  };
}

/**
 * Format a vehicle price for a display currency.
 * Always converts from the USD canonical `price` using active FX rates so
 * storefront cards stay in sync with the live exchange-rate feed (and the
 * currency calculator). Exact `listedPrice` is reserved for admin form editing
 * via `listingAmountForForm` — not for public display.
 */
export function formatVehiclePrice(
  fields: VehiclePriceFields,
  displayCurrency: string
): string {
  const listingCurrency = resolveListingCurrency(fields.priceCurrency);
  const display = (displayCurrency || listingCurrency).toUpperCase();
  return formatUsdPrice(fields.price || 0, display);
}
