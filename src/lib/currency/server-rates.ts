import "server-only";

import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import {
  EXCHANGE_RATE_CACHE_TTL_SECONDS,
  fetchLiveExchangeRates,
  type ExchangeRatePayload,
} from "./fetch-exchange-rates";
import {
  applyDisplayRateOverride,
  type EffectiveExchangeRatesPayload,
} from "./display-override";
import { persistLastGoodRates, readLastGoodRates } from "./persist-cache";
import { getSiteSettings } from "@/lib/platform/site-settings-server";

export const EXCHANGE_RATES_CACHE_TAG = "exchange-rates";

export type { EffectiveExchangeRatesPayload as ServerExchangeRatesPayload };
export type { DisplayOverrideMeta } from "./display-override";

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

async function withDisplayOverride(
  payload: ExchangeRatePayload
): Promise<EffectiveExchangeRatesPayload> {
  const settings = await getSiteSettings();
  return applyDisplayRateOverride(payload, settings);
}

export async function getMarketExchangeRates(): Promise<ExchangeRatePayload> {
  return getCachedLiveRates();
}

export async function getServerExchangeRates(): Promise<EffectiveExchangeRatesPayload> {
  const payload = await getCachedLiveRates();
  return withDisplayOverride(payload);
}

export async function refreshServerExchangeRates(): Promise<EffectiveExchangeRatesPayload> {
  const live = await fetchLiveExchangeRates({ bypassCache: true });
  if (!live.stale) {
    await persistLastGoodRates(live);
  }
  try {
    revalidateTag(EXCHANGE_RATES_CACHE_TAG, { expire: 0 });
  } catch {
    // revalidateTag can throw outside a request context — ignore.
  }

  const lastGood = await readLastGoodRates();
  const resolved = !live.stale
    ? live
    : lastGood
      ? {
          ...lastGood,
          stale: true,
          error: live.error ?? "Live feed unavailable; using last-good cached rates.",
        }
      : live;

  return withDisplayOverride(resolved);
}
