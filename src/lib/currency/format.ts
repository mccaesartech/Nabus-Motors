import { DEFAULT_DISPLAY_CURRENCY, REFERENCE_CURRENCIES } from "./types";
import { convertFromUsd } from "./rates";
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
  displayCurrency: string = DEFAULT_DISPLAY_CURRENCY
): string {
  const converted = convertFromUsd(usdAmount, displayCurrency);
  return formatAmount(converted, displayCurrency);
}

/** Format a USD-stored amount in GHS — server-side / email fallback only. */
export function formatPlatformPrice(usdAmount: number): string {
  return formatUsdPrice(usdAmount, DEFAULT_DISPLAY_CURRENCY);
}

export function formatFilterPriceLabel(
  usdAmount: number,
  displayCurrency: string
): string {
  return `Up to ${formatUsdPrice(usdAmount, displayCurrency)}`;
}

/** Compact multi-currency preview for admin dashboards */
export function formatAdminCurrencyPreviews(usdAmount: number): string {
  const codes = ["GHS", "ZWL", "ZAR"] as const;
  return codes.map((code) => formatUsdPrice(usdAmount, code)).join(" · ");
}

export { REFERENCE_CURRENCIES, getCurrencyLabel };
