import { REFERENCE_CURRENCIES } from "./types";
import type { ExchangeRateSource } from "./types";
import { getStaticFallbackRates, type ExchangeRateMap } from "./rates";
import { EXCHANGE_RATE_CACHE_TTL_SECONDS } from "./fetch-exchange-rates-constants";
import { getDefaultFxProvider } from "./providers/exchangerate-api";
import type { FxProviderRequest } from "./providers/types";

export type { ExchangeRateSource };
export { EXCHANGE_RATE_CACHE_TTL_SECONDS };

export type ExchangeRatePayload = {
  rates: ExchangeRateMap;
  ratesFromGhs: ExchangeRateMap;
  source: ExchangeRateSource;
  stale: boolean;
  fetchedAt: string;
  rateDate?: string;
  provider: string;
  error?: string;
};

let inflight: Promise<ExchangeRatePayload> | null = null;

export function buildRatesFromGhs(usdRates: ExchangeRateMap): ExchangeRateMap {
  const ghsPerUsd = usdRates.GHS;
  if (!ghsPerUsd || ghsPerUsd <= 0) {
    return { GHS: 1 };
  }

  const fromGhs: ExchangeRateMap = { GHS: 1 };
  for (const [code, ratePerUsd] of Object.entries(usdRates)) {
    if (code === "GHS") continue;
    if (typeof ratePerUsd === "number" && ratePerUsd > 0) {
      fromGhs[code] = ratePerUsd / ghsPerUsd;
    }
  }
  return fromGhs;
}

export function mergeLiveRates(apiRates: Record<string, number>): ExchangeRateMap {
  const fallbacks = getStaticFallbackRates();
  const merged: ExchangeRateMap = { USD: 1, ...fallbacks };

  for (const [code, rate] of Object.entries(apiRates)) {
    if (typeof rate === "number" && rate > 0) {
      merged[code.toUpperCase()] = rate;
    }
  }

  return merged;
}

function buildFallbackPayload(error?: string): ExchangeRatePayload {
  const rates = getStaticFallbackRates();
  return {
    rates,
    ratesFromGhs: buildRatesFromGhs(rates),
    source: "fallback",
    stale: true,
    fetchedAt: new Date().toISOString(),
    provider: "fallback",
    error,
  };
}

async function fetchLiveExchangeRatesOnce(
  request: FxProviderRequest = {}
): Promise<ExchangeRatePayload> {
  try {
    const quote = await getDefaultFxProvider().fetchUsdLatest(request);
    const rates = mergeLiveRates(quote.rates);

    for (const code of REFERENCE_CURRENCIES) {
      if (!rates[code] || rates[code] <= 0) {
        rates[code] = getStaticFallbackRates()[code] ?? 1;
      }
    }

    return {
      rates,
      ratesFromGhs: buildRatesFromGhs(rates),
      source: "exchangerate-api",
      stale: false,
      fetchedAt: new Date().toISOString(),
      rateDate: quote.rateDate,
      provider: quote.provider,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Exchange-rate provider is unavailable.";
    return buildFallbackPayload(message);
  }
}

/**
 * Fetch USD-base mid-market rates. Concurrent callers share one in-flight request.
 * On provider failure this returns emergency env fallbacks (stale=true) — server
 * code should prefer last-good DB cache via getServerExchangeRates().
 */
export async function fetchLiveExchangeRates(
  request: FxProviderRequest = {}
): Promise<ExchangeRatePayload> {
  if (request.bypassCache) {
    return fetchLiveExchangeRatesOnce(request);
  }
  if (inflight) return inflight;
  inflight = fetchLiveExchangeRatesOnce(request).finally(() => {
    inflight = null;
  });
  return inflight;
}
