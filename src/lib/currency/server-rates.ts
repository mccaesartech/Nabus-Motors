import "server-only";

import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import {
  EXCHANGE_RATE_CACHE_TTL_SECONDS,
  fetchLiveExchangeRates,
  type ExchangeRatePayload,
} from "./fetch-exchange-rates";
import { persistLastGoodRates, readLastGoodRates } from "./persist-cache";

export const EXCHANGE_RATES_CACHE_TAG = "exchange-rates";

async function loadRatesWithLastGood(): Promise<ExchangeRatePayload> {
  const live = await fetchLiveExchangeRates();
  if (!live.stale) {
    await persistLastGoodRates(live);
    return live;
  }

  const lastGood = await readLastGoodRates();
  if (lastGood) {
    return {
      ...lastGood,
      stale: true,
      error: live.error ?? "Live feed unavailable; using last-good cached rates.",
    };
  }

  return live;
}

const getCachedLiveRates = unstable_cache(
  async () => loadRatesWithLastGood(),
  ["live-exchange-rates"],
  {
    revalidate: EXCHANGE_RATE_CACHE_TTL_SECONDS,
    tags: [EXCHANGE_RATES_CACHE_TAG],
  }
);

export async function getServerExchangeRates(): Promise<ExchangeRatePayload> {
  return getCachedLiveRates();
}

/** Authorized refresh: hit the provider, persist last-good, bust the data cache. */
export async function refreshServerExchangeRates(): Promise<ExchangeRatePayload> {
  const live = await fetchLiveExchangeRates({ bypassCache: true });
  if (!live.stale) {
    await persistLastGoodRates(live);
  }
  try {
    revalidateTag(EXCHANGE_RATES_CACHE_TAG, { expire: 0 });
  } catch {
    // revalidateTag can throw outside a request context — ignore.
  }
  if (!live.stale) return live;

  const lastGood = await readLastGoodRates();
  if (lastGood) {
    return {
      ...lastGood,
      stale: true,
      error: live.error ?? "Live feed unavailable; using last-good cached rates.",
    };
  }
  return live;
}
