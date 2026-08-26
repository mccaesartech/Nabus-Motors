import "server-only";

import { unstable_cache } from "next/cache";
import {
  EXCHANGE_RATE_CACHE_TTL_SECONDS,
  fetchLiveExchangeRates,
  type ExchangeRatePayload,
} from "./fetch-exchange-rates";

const getCachedLiveRates = unstable_cache(
  async () => fetchLiveExchangeRates(),
  ["live-exchange-rates"],
  {
    revalidate: EXCHANGE_RATE_CACHE_TTL_SECONDS,
    tags: ["exchange-rates"],
  }
);

export async function getServerExchangeRates(): Promise<ExchangeRatePayload> {
  return getCachedLiveRates();
}