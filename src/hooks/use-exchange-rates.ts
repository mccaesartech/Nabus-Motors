"use client";

import { useEffect, useState } from "react";
import { setExchangeRates } from "@/lib/currency/rates";
import type { ExchangeRateSource } from "@/lib/currency/types";

export type ExchangeRatesMeta = {
  source: ExchangeRateSource;
  stale: boolean;
  fetchedAt: string | null;
  rateDate: string | null;
  provider: string | null;
  error: string | null;
};

type ExchangeRatesApiResponse = {
  rates?: Record<string, number>;
  stale?: boolean;
  source?: ExchangeRateSource;
  fetchedAt?: string;
  rateDate?: string;
  provider?: string;
  error?: string;
};

type UseExchangeRatesOptions = {
  /** Defer fetch until browser idle — used on the public storefront. */
  defer?: boolean;
};

const DEFAULT_META: ExchangeRatesMeta = {
  source: "fallback",
  stale: true,
  fetchedAt: null,
  rateDate: null,
  provider: "fallback",
  error: null,
};

export function useExchangeRates(options: UseExchangeRatesOptions = {}) {
  const { defer = false } = options;
  const [ratesLoaded, setRatesLoaded] = useState(false);
  const [ratesStale, setRatesStale] = useState(false);
  const [meta, setMeta] = useState<ExchangeRatesMeta>(DEFAULT_META);

  useEffect(() => {
    let cancelled = false;

    const loadRates = () => {
      fetch("/api/exchange-rates")
        .then((res) => res.json())
        .then((data: ExchangeRatesApiResponse) => {
          if (cancelled || !data.rates) return;
          setExchangeRates(data.rates);
          setRatesStale(data.stale === true);
          setMeta({
            source: data.source ?? "fallback",
            stale: data.stale === true,
            fetchedAt: data.fetchedAt ?? null,
            rateDate: data.rateDate ?? null,
            provider: data.provider ?? data.source ?? null,
            error: data.error ?? null,
          });
          setRatesLoaded(true);
        })
        .catch(() => {
          if (!cancelled) {
            setRatesStale(true);
            setRatesLoaded(true);
          }
        });
    };

    let idleId: number | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    if (defer) {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(loadRates, { timeout: 1500 });
      } else {
        timerId = setTimeout(loadRates, 100);
      }
    } else {
      loadRates();
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timerId !== undefined) clearTimeout(timerId);
    };
  }, [defer]);

  return { ratesLoaded, ratesStale, meta };
}
