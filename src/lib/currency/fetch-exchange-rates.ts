import { REFERENCE_CURRENCIES } from "./types";
import { getStaticFallbackRates, type ExchangeRateMap } from "./rates";

export type ExchangeRateSource = "exchangerate-api" | "fallback";

export type ExchangeRatePayload = {
  rates: ExchangeRateMap;
  ratesFromGhs: ExchangeRateMap;
  source: ExchangeRateSource;
  stale: boolean;
  fetchedAt: string;
  rateDate?: string;
};

export const EXCHANGE_RATE_CACHE_TTL_SECONDS = 1800;

const OPEN_ER_API_URL = "https://open.er-api.com/v6/latest/USD";

function exchangeRateApiUrl(): string {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY?.trim();
  if (apiKey) {
    return `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;
  }
  return OPEN_ER_API_URL;
}

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

function buildFallbackPayload(): ExchangeRatePayload {
  const rates = getStaticFallbackRates();
  return {
    rates,
    ratesFromGhs: buildRatesFromGhs(rates),
    source: "fallback",
    stale: true,
    fetchedAt: new Date().toISOString(),
  };
}

type ExchangeRateApiResponse = {
  result?: string;
  base_code?: string;
  rates?: Record<string, number>;
  time_last_update_utc?: string;
};

export async function fetchLiveExchangeRates(): Promise<ExchangeRatePayload> {
  const fallbackPayload = buildFallbackPayload();

  try {
    // Route/CDN cache (revalidate + s-maxage) owns freshness; do not silently
    // serve outdated NEXT_PUBLIC_* env defaults as if they were live.
    const res = await fetch(exchangeRateApiUrl(), {
      next: { revalidate: EXCHANGE_RATE_CACHE_TTL_SECONDS },
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return fallbackPayload;

    const data = (await res.json()) as ExchangeRateApiResponse;
    if (data.result !== "success" || !data.rates) return fallbackPayload;

    const rates = mergeLiveRates(data.rates);

    for (const code of REFERENCE_CURRENCIES) {
      if (!rates[code] || rates[code] <= 0) {
        rates[code] = fallbackPayload.rates[code] ?? 1;
      }
    }

    return {
      rates,
      ratesFromGhs: buildRatesFromGhs(rates),
      source: "exchangerate-api",
      stale: false,
      fetchedAt: new Date().toISOString(),
      rateDate: data.time_last_update_utc,
    };
  } catch {
    // Explicit fallback path: source=fallback, stale=true (see buildFallbackPayload).
    return fallbackPayload;
  }
}