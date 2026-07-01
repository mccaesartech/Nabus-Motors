"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DEFAULT_DISPLAY_CURRENCY, formatUsdPrice } from "@/lib/currency";
import { setExchangeRates } from "@/lib/currency/rates";
import {
  COUNTRY_CODES,
  COUNTRIES,
  countryForCurrency,
  DEFAULT_COUNTRY,
  getCountryConfig,
  type CountryCode,
  type CountryConfig,
} from "@/lib/countries";

export const PLATFORM_COUNTRY_STORAGE_KEY = "true-goshen-platform-country";
export const PLATFORM_CURRENCY_STORAGE_KEY = "true-goshen-platform-currency";

const DEFAULT_CURRENCY = DEFAULT_DISPLAY_CURRENCY;

interface PlatformCurrencyContextValue {
  currency: string;
  setCurrency: (currency: string) => void;
  country: CountryCode;
  setCountry: (country: CountryCode) => void;
  countries: readonly CountryConfig[];
  formatPrice: (usdAmount: number) => string;
  ratesLoaded: boolean;
}

const PlatformCurrencyContext =
  createContext<PlatformCurrencyContextValue | null>(null);

function readStoredPlatformCountry(): CountryCode | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(PLATFORM_COUNTRY_STORAGE_KEY);
    if (stored && COUNTRY_CODES.includes(stored as CountryCode)) {
      return stored as CountryCode;
    }
    const legacyCurrency = localStorage.getItem(PLATFORM_CURRENCY_STORAGE_KEY);
    if (legacyCurrency) {
      return countryForCurrency(legacyCurrency);
    }
  } catch {
    // ignore
  }
  return null;
}

function resolveInitialPlatformPreferences(): {
  country: CountryCode;
  currency: string;
} {
  const storedCountry = readStoredPlatformCountry();
  if (storedCountry) {
    return {
      country: storedCountry,
      currency: getCountryConfig(storedCountry).currency,
    };
  }

  return {
    country: DEFAULT_COUNTRY,
    currency: DEFAULT_CURRENCY,
  };
}

function persistPlatformPreferences(country: CountryCode, currency: string) {
  try {
    localStorage.setItem(PLATFORM_COUNTRY_STORAGE_KEY, country);
    localStorage.setItem(PLATFORM_CURRENCY_STORAGE_KEY, currency);
  } catch {
    // ignore
  }
}

export function PlatformCurrencyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [country, setCountryState] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [currency, setCurrencyState] = useState<string>(DEFAULT_CURRENCY);
  const [hydrated, setHydrated] = useState(false);
  const [ratesLoaded, setRatesLoaded] = useState(false);

  useEffect(() => {
    const initial = resolveInitialPlatformPreferences();
    setCountryState(initial.country);
    setCurrencyState(initial.currency);
    setHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/exchange-rates")
      .then((res) => res.json())
      .then((data: { rates?: Record<string, number> }) => {
        if (cancelled || !data.rates) return;
        setExchangeRates(data.rates);
        setRatesLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setRatesLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setCountry = useCallback((next: CountryCode) => {
    const config = getCountryConfig(next);
    setCountryState(next);
    setCurrencyState(config.currency);
    persistPlatformPreferences(next, config.currency);
  }, []);

  const setCurrency = useCallback((next: string) => {
    const nextCountry = countryForCurrency(next);
    setCurrencyState(next);
    setCountryState(nextCountry);
    persistPlatformPreferences(nextCountry, next);
  }, []);

  const displayCountry = hydrated ? country : DEFAULT_COUNTRY;
  const displayCurrency = hydrated ? currency : DEFAULT_CURRENCY;

  const formatPrice = useCallback(
    (usdAmount: number) => formatUsdPrice(usdAmount, displayCurrency),
    [displayCurrency, ratesLoaded]
  );

  const value = useMemo(
    () => ({
      currency: displayCurrency,
      setCurrency,
      country: displayCountry,
      setCountry,
      countries: COUNTRIES,
      formatPrice,
      ratesLoaded,
    }),
    [
      displayCountry,
      displayCurrency,
      formatPrice,
      ratesLoaded,
      setCountry,
      setCurrency,
    ]
  );

  return (
    <PlatformCurrencyContext.Provider value={value}>
      {children}
    </PlatformCurrencyContext.Provider>
  );
}

export function usePlatformCurrency() {
  const ctx = useContext(PlatformCurrencyContext);
  if (!ctx) {
    throw new Error(
      "usePlatformCurrency must be used within PlatformCurrencyProvider"
    );
  }
  return ctx;
}
