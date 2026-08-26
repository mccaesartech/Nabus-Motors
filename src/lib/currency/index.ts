export * from "./types";
export * from "./names";
export * from "./rates";
export * from "./format";
export * from "./listing";
export * from "./checkout";
export * from "./calculator-currencies";
/** Pure helpers only — do not re-export `fetchLiveExchangeRates` (server/network). */
export {
  EXCHANGE_RATE_CACHE_TTL_SECONDS,
  buildRatesFromGhs,
  mergeLiveRates,
  type ExchangeRatePayload,
  type ExchangeRateSource,
} from "./fetch-exchange-rates";

export const PRICE_FILTER_TIERS = [
  20000, 30000, 40000, 50000, 60000, 75000, 100000,
] as const;
