import type { ExchangeRateSource } from "./types";

export const FX_MARKET_DISCLAIMER =
  "Mid-market rate from ExchangeRate-API for guidance only — not a bank quote. May differ slightly from Google Finance.";

export const FX_MANUAL_LABEL = "Manual Exchange Rate";

export type FxDisplayKind = "live" | "cached" | "fallback" | "manual";

export function fxDisplayKind(input: {
  source?: ExchangeRateSource | string | null;
  stale?: boolean;
  isManual?: boolean;
}): FxDisplayKind {
  if (input.isManual) return "manual";
  if (input.source === "fallback") return "fallback";
  if (input.source === "cache" || input.stale) return "cached";
  return "live";
}

export function rateSourceLabel(input: {
  source?: ExchangeRateSource | string | null;
  stale?: boolean;
  isManual?: boolean;
  providerName?: string | null;
}): string {
  const kind = fxDisplayKind(input);
  if (kind === "manual") return FX_MANUAL_LABEL;
  if (kind === "fallback") return "Emergency fallback (not live market)";
  if (kind === "cached") return "Cached last-good rate (not live market)";
  return input.providerName
    ? `Live mid-market · ${input.providerName}`
    : "Live mid-market";
}

export function formatUsdGhsRateLine(ghsPerUsd: number): string {
  if (!Number.isFinite(ghsPerUsd) || ghsPerUsd <= 0) return "1 USD = — GHS";
  const digits = ghsPerUsd >= 10 ? 4 : 6;
  return `1 USD = ${ghsPerUsd.toFixed(digits)} GHS`;
}

export function formatUpdatedAt(iso: string | null | undefined): string {
  if (!iso) return "Unknown";
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
