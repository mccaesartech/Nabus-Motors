"use client";

import { useEffect, useState } from "react";
import { setExchangeRates } from "@/lib/currency/rates";

export type ExchangeRatesMeta = {
  source: "exchangerate-api" | "fallback";
  stale: boolean;
  fetchedAt: string | null;
  rateDate: string | null;
};

type ExchangeRatesApiResponse = {
  rates?: Record<string, number>;
  stale?: boolean;
  source?: "exchangerate-api" | "fallback";
  fetchedAt?: string;
  rateDate?: string;
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
