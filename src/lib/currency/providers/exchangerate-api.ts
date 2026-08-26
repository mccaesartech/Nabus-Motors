import { EXCHANGE_RATE_CACHE_TTL_SECONDS } from "../fetch-exchange-rates-constants";
import {
  EXCHANGE_RATE_API_DISPLAY_NAME,
  FX_FETCH_TIMEOUT_MS,
  type FxProvider,
  type FxProviderQuote,
  type FxProviderRequest,
} from "./types";

const OPEN_ER_API_URL = "https://open.er-api.com/v6/latest/USD";

type ExchangeRateApiResponse = {
  result?: string;
  base_code?: string;
  rates?: Record<string, number>;
  time_last_update_utc?: string;
  "error-type"?: string;
};

function exchangeRateApiUrl(): string {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY?.trim();
  if (apiKey) {
    return `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;
  }
  return OPEN_ER_API_URL;
}

/** Never log URLs that may contain a paid API key. */
export function describeFxProviderEndpoint(): string {
  return process.env.EXCHANGE_RATE_API_KEY?.trim()
    ? "exchangerate-api.com (authenticated)"
    : "open.er-api.com";
}

export class FxProviderError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "FxProviderError";
    this.status = status;
  }
}

export const exchangeRateApiProvider: FxProvider = {
  id: "exchangerate-api",
  displayName: EXCHANGE_RATE_API_DISPLAY_NAME,

  async fetchUsdLatest(request: FxProviderRequest = {}): Promise<FxProviderQuote> {
    const timeoutMs = request.timeoutMs ?? FX_FETCH_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(exchangeRateApiUrl(), {
        ...(request.bypassCache
          ? { cache: "no-store" as const }
          : {
              next: {
                revalidate: EXCHANGE_RATE_CACHE_TTL_SECONDS,
                tags: ["exchange-rates"],
              },
            }),
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (res.status === 429) {
        throw new FxProviderError(
          "Exchange-rate provider rate limit reached. Using last-good rates.",
          429
        );
      }

      if (!res.ok) {
        throw new FxProviderError(
          `Exchange-rate provider returned ${res.status}.`,
          res.status
        );
      }

      const data = (await res.json()) as ExchangeRateApiResponse;
      if (data.result !== "success" || !data.rates || typeof data.rates !== "object") {
        throw new FxProviderError(
          data["error-type"] === "invalid-key"
            ? "Exchange-rate provider rejected the configured key."
            : "Exchange-rate provider returned an incomplete payload."
        );
      }

      const rates: Record<string, number> = {};
      for (const [code, rate] of Object.entries(data.rates)) {
        if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) {
          rates[code.toUpperCase()] = rate;
        }
      }

      if (!rates.USD) rates.USD = 1;
      if (!rates.GHS) {
        throw new FxProviderError("Exchange-rate provider omitted GHS.");
      }

      return {
        provider: "exchangerate-api",
        displayName: EXCHANGE_RATE_API_DISPLAY_NAME,
        base: "USD",
        rates,
        rateDate: data.time_last_update_utc,
      };
    } catch (error) {
      if (error instanceof FxProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new FxProviderError("Exchange-rate provider timed out.");
      }
      throw new FxProviderError("Exchange-rate provider is unreachable.");
    } finally {
      clearTimeout(timer);
    }
  },
};

export function getDefaultFxProvider(): FxProvider {
  return exchangeRateApiProvider;
}
