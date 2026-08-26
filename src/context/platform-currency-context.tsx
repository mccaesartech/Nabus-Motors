"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_DISPLAY_CURRENCY,
  formatUsdPrice,
  formatVehiclePrice,
  type VehiclePriceFields,
} from "@/lib/currency";
import {
  useExchangeRates,
  type ExchangeRatesMeta,
} from "@/hooks/use-exchange-rates";
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

interface PlatformCurrencyContextValue {
  currency: string;
  setCurrency: (currency: string) => void;
  country: CountryCode;
  setCountry: (country: CountryCode) => void;
  countries: readonly CountryConfig[];
  /** Format a USD-canonical amount in the platform display currency. */
  formatPrice: (usdAmount: number) => string;
  /** Format a vehicle from USD canonical price using active FX rates. */
  formatVehicleListPrice: (fields: VehiclePriceFields) => string;
  /** Site setting default — also used as default listing currency for new vehicles. */
  settingsDefaultCurrency: string;
  ratesLoaded: boolean;
  /** True when live FX API failed and fallback rates are in use. */
  ratesStale: boolean;
  /** Metadata from the shared /api/exchange-rates feed. */
  ratesMeta: ExchangeRatesMeta;
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

function resolveInitialPlatformPreferences(settingsDefault: string): {
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

  const currency = (settingsDefault || DEFAULT_DISPLAY_CURRENCY).toUpperCase();
  return {
    country: countryForCurrency(currency),
    currency,
  };
}

function persistPlatformPreferences(country: CountryCode, currency: string) {
  try {
    // Platform-only keys — never write public frontend currency storage.
    localStorage.setItem(PLATFORM_COUNTRY_STORAGE_KEY, country);
    localStorage.setItem(PLATFORM_CURRENCY_STORAGE_KEY, currency);
  } catch {
    // ignore
  }
}

export function PlatformCurrencyProvider({
  children,
  settingsDefaultCurrency = DEFAULT_DISPLAY_CURRENCY,
}: {
  children: React.ReactNode;
  /** From site_settings.default_currency_display — does not affect public visitors. */
  settingsDefaultCurrency?: string;
}) {
  const settingsDefault = (
    settingsDefaultCurrency || DEFAULT_DISPLAY_CURRENCY
  ).toUpperCase();
  const [country, setCountryState] = useState<CountryCode>(() =>
    countryForCurrency(settingsDefault)
  );
  const [currency, setCurrencyState] = useState<string>(settingsDefault);
  const [hydrated, setHydrated] = useState(false);
  const { ratesLoaded, ratesStale, meta: ratesMeta } = useExchangeRates();

  useEffect(() => {
    const initial = resolveInitialPlatformPreferences(settingsDefault);
    setCountryState(initial.country);
    setCurrencyState(initial.currency);
    setHydrated(true);
  }, [settingsDefault]);

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

  const displayCountry = hydrated
    ? country
    : countryForCurrency(settingsDefault);
  const displayCurrency = hydrated ? currency : settingsDefault;

  const formatPrice = useCallback(
    (usdAmount: number) => formatUsdPrice(usdAmount, displayCurrency),
    [displayCurrency, ratesLoaded]
  );

  const formatVehicleListPrice = useCallback(
    (fields: VehiclePriceFields) => formatVehiclePrice(fields, displayCurrency),
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
      formatVehicleListPrice,
      settingsDefaultCurrency: settingsDefault,
      ratesLoaded,
      ratesStale,
      ratesMeta,
    }),
    [
      displayCountry,
      displayCurrency,
      formatPrice,
      formatVehicleListPrice,
      ratesLoaded,
      ratesMeta,
      ratesStale,
      setCountry,
      setCurrency,
      settingsDefault,
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
