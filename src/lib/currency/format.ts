import { DEFAULT_DISPLAY_CURRENCY, REFERENCE_CURRENCIES } from "./types";
import { convertFromUsd } from "./convert";
import type { ExchangeRateMap } from "./rates";
import { getCurrencyLabel } from "./names";

export function formatAmount(amount: number, currency: string): string {
  const rounded = Math.round(amount);
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(rounded);
  } catch {
    return `${currency} ${rounded.toLocaleString("en-US")}`;
  }
}

export function formatUsdPrice(
  usdAmount: number,
  displayCurrency: string = DEFAULT_DISPLAY_CURRENCY,
  rates?: ExchangeRateMap
): string {
  const converted = convertFromUsd(usdAmount, displayCurrency, rates);
  return formatAmount(converted, displayCurrency);
}

/** Format a USD-stored amount in GHS (pass live `rates` on the server). */
export function formatPlatformPrice(
  usdAmount: number,
  rates?: ExchangeRateMap
): string {
  return formatUsdPrice(usdAmount, DEFAULT_DISPLAY_CURRENCY, rates);
}

export function formatFilterPriceLabel(
  usdAmount: number,
  displayCurrency: string,
  rates?: ExchangeRateMap
): string {
  return `Up to ${formatUsdPrice(usdAmount, displayCurrency, rates)}`;
}

/** Compact multi-currency preview for admin dashboards (amounts are USD). */
export function formatAdminCurrencyPreviews(
  usdAmount: number,
  rates?: ExchangeRateMap
): string {
  const codes = ["GHS", "USD", "EUR"] as const;
  return codes.map((code) => formatUsdPrice(usdAmount, code, rates)).join(" · ");
}

export { REFERENCE_CURRENCIES, getCurrencyLabel };
