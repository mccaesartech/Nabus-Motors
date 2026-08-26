import type { ExchangeRateMap } from "../rates";

/** Identifiers for FX providers. Swap implementations without rewriting conversion math. */
export type FxProviderId = "exchangerate-api";

export type FxProviderRequest = {
  /** Skip HTTP cache so a manual refresh hits the provider. */
  bypassCache?: boolean;
  timeoutMs?: number;
};

export type FxProviderQuote = {
  provider: FxProviderId;
  displayName: string;
  base: "USD";
  rates: ExchangeRateMap;
  rateDate?: string;
};

export interface FxProvider {
  readonly id: FxProviderId;
  readonly displayName: string;
  fetchUsdLatest(request?: FxProviderRequest): Promise<FxProviderQuote>;
}

export const FX_FETCH_TIMEOUT_MS = 8000;
export const EXCHANGE_RATE_API_DISPLAY_NAME = "ExchangeRate-API";
