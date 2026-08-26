"use client";

import { useCallback, useEffect, useState } from "react";
import { setExchangeRates } from "@/lib/currency/rates";
import type { DisplayOverrideMeta } from "@/lib/currency/display-override";
import type { ExchangeRateSource } from "@/lib/currency/types";

export type ExchangeRatesMeta = {
  source: ExchangeRateSource;
  stale: boolean;
  fetchedAt: string | null;
  rateDate: string | null;
  provider: string | null;
  error: string | null;
  displayOverride: DisplayOverrideMeta | null;
};

type ExchangeRatesApiResponse = {
  rates?: Record<string, number>;
  stale?: boolean;
  source?: ExchangeRateSource;
  fetchedAt?: string;
  rateDate?: string;
  provider?: string;
  error?: string;
  displayOverride?: DisplayOverrideMeta | null;
};

type UseExchangeRatesOptions = {
  defer?: boolean;
};

const DEFAULT_META: ExchangeRatesMeta = {
  source: "fallback",
  stale: true,
  fetchedAt: null,
  rateDate: null,
  provider: "fallback",
  error: null,
  displayOverride: null,
};

export function useExchangeRates(options: UseExchangeRatesOptions = {}) {
  const { defer = false } = options;
  const [ratesLoaded, setRatesLoaded] = useState(false);
  const [ratesStale, setRatesStale] = useState(false);
  const [meta, setMeta] = useState<ExchangeRatesMeta>(DEFAULT_META);

  const loadRates = useCallback(async () => {
    try {
      const res = await fetch("/api/exchange-rates");
      const data = (await res.json()) as ExchangeRatesApiResponse;
      if (!data.rates) return;
      setExchangeRates(data.rates);
      setRatesStale(data.stale === true);
      setMeta({
        source: data.source ?? "fallback",
        stale: data.stale === true,
        fetchedAt: data.fetchedAt ?? null,
        rateDate: data.rateDate ?? null,
        provider: data.provider ?? data.source ?? null,
        error: data.error ?? null,
        displayOverride: data.displayOverride ?? null,
      });
      setRatesLoaded(true);
    } catch {
      setRatesStale(true);
      setRatesLoaded(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      void loadRates().then(() => {
        if (cancelled) return;
      });
    };

    let idleId: number | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    if (defer) {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(run, { timeout: 1500 });
      } else {
        timerId = setTimeout(run, 100);
      }
    } else {
      run();
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timerId !== undefined) clearTimeout(timerId);
    };
  }, [defer, loadRates]);

  return { ratesLoaded, ratesStale, meta, refetch: loadRates };
}
