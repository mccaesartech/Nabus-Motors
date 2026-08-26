"use client";

import {
  FX_MARKET_DISCLAIMER,
  formatUsdGhsRateLine,
  formatUpdatedAt,
  rateSourceLabel,
} from "@/lib/currency/meta";
import { getActiveRates } from "@/lib/currency/rates";
import type { ExchangeRatesMeta } from "@/hooks/use-exchange-rates";
import { cn } from "@/lib/utils";

type ExchangeRateUsedProps = {
  ratesMeta?: ExchangeRatesMeta;
  ratesStale?: boolean;
  className?: string;
};

export function ExchangeRateUsed({
  ratesMeta,
  ratesStale,
  className,
}: ExchangeRateUsedProps) {
  const ghsPerUsd = getActiveRates().GHS ?? 0;
  const updated = ratesMeta?.rateDate || ratesMeta?.fetchedAt;
  const sourceLabel = rateSourceLabel({
    source: ratesMeta?.source,
    stale: ratesStale ?? ratesMeta?.stale,
    providerName:
      ratesMeta?.provider === "exchangerate-api" || !ratesMeta?.provider
        ? "ExchangeRate-API"
        : ratesMeta.provider,
  });

  return (
    <p
      className={cn("mt-3 text-xs leading-relaxed text-muted-foreground", className)}
      data-testid="exchange-rate-used"
    >
      <span className="font-medium text-foreground/80">Exchange rate used:</span>{" "}
      {formatUsdGhsRateLine(ghsPerUsd)}
      {updated ? ` · Last updated ${formatUpdatedAt(updated)}` : ""}
      {` · ${sourceLabel}. `}
      {FX_MARKET_DISCLAIMER}
    </p>
  );
}
