import "server-only";

import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import {
  EXCHANGE_RATE_CACHE_TTL_SECONDS,
  buildRatesFromGhs,
  fetchLiveExchangeRates,
  type ExchangeRatePayload,
} from "./fetch-exchange-rates";
import {
  isDisplayOverrideActive,
  parseManualRatesJson,
  type ExchangeRateMap,
} from "./rates";
import { persistLastGoodRates, readLastGoodRates } from "./persist-cache";
import { getSiteSettings } from "@/lib/platform/site-settings-server";

export const EXCHANGE_RATES_CACHE_TAG = "exchange-rates";

export type DisplayOverrideMeta = {
  active: boolean;
  targetCurrency: string;
  rateUsed: number;
  liveRate: number;
  reason: string | null;
  setAt: string | null;
  setBy: string | null;
};

export type EffectiveExchangeRatesPayload = ExchangeRatePayload & {
  liveRates: ExchangeRateMap;
  displayOverride: DisplayOverrideMeta | null;
};

export type { EffectiveExchangeRatesPayload as ServerExchangeRatesPayload };

export { isDisplayOverrideActive, parseManualRatesJson };

function applyDisplayRateOverride(
  payload: ExchangeRatePayload,
  settings: {
    fx_use_live_rates?: string;
    fx_manual_rates_json?: string;
    fx_manual_rate_reason?: string;
    fx_manual_rate_set_by?: string;
    fx_manual_rate_set_at?: string;
  }
): EffectiveExchangeRatesPayload {
  const liveRates = { ...payload.rates };

  if (!isDisplayOverrideActive(settings)) {
    return { ...payload, liveRates, displayOverride: null };
  }

  const manualRates = parseManualRatesJson(settings.fx_manual_rates_json);
  const ghsRate = manualRates.GHS;
  if (!ghsRate || ghsRate <= 0) {
    return { ...payload, liveRates, displayOverride: null };
  }

  const effectiveRates: ExchangeRateMap = { ...payload.rates, GHS: ghsRate };

  return {
    ...payload,
    rates: effectiveRates,
    ratesFromGhs: buildRatesFromGhs(effectiveRates),
    source: "manual",
    stale: false,
    provider: "manual-override",
    liveRates,
    displayOverride: {
      active: true,
      targetCurrency: "GHS",
      rateUsed: ghsRate,
      liveRate: liveRates.GHS ?? ghsRate,
      reason: settings.fx_manual_rate_reason?.trim() || null,
      setAt: settings.fx_manual_rate_set_at?.trim() || null,
      setBy: settings.fx_manual_rate_set_by?.trim() || null,
    },
  };
}

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
