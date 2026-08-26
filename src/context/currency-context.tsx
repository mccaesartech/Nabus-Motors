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

const COUNTRY_STORAGE_KEY = "true-goshen-country-v2";
const CURRENCY_STORAGE_KEY = "true-goshen-currency-v2";
const LEGACY_COUNTRY_STORAGE_KEY = "true-goshen-country";
const LEGACY_CURRENCY_STORAGE_KEY = "true-goshen-currency";

const DEFAULT_CURRENCY = DEFAULT_DISPLAY_CURRENCY;

interface CurrencyContextValue {
  currency: string;
  setCurrency: (currency: string) => void;
  country: CountryCode;
  setCountry: (country: CountryCode) => void;
  countries: readonly CountryConfig[];
  /** Admin-configured default from site_settings.default_currency_display. */
  settingsDefaultCurrency: string;
  formatPrice: (usdAmount: number) => string;
  formatVehicleListPrice: (fields: VehiclePriceFields) => string;
  ratesLoaded: boolean;
  /** True when live FX API failed and fallback rates are in use. */
  ratesStale: boolean;
  /** Metadata from the shared /api/exchange-rates feed. */
  ratesMeta: ExchangeRatesMeta;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function readStoredCountry(): CountryCode | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(COUNTRY_STORAGE_KEY);
    if (stored && COUNTRY_CODES.includes(stored as CountryCode)) {
      return stored as CountryCode;
    }
  } catch {
    // ignore
  }
  return null;
}

function clearLegacyStorage() {
  try {
    localStorage.removeItem(LEGACY_COUNTRY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_CURRENCY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function resolveInitialPreferences(): {
  country: CountryCode;
  currency: string;
} {
  const storedCountry = readStoredCountry();
  if (storedCountry) {
    return {
      country: storedCountry,
      currency: getCountryConfig(storedCountry).currency,
    };
  }

  clearLegacyStorage();

  return {
    country: DEFAULT_COUNTRY,
    currency: DEFAULT_CURRENCY,
  };
}

function persistPreferences(country: CountryCode, currency: string) {
  try {
    localStorage.setItem(COUNTRY_STORAGE_KEY, country);
    localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
  } catch {
    // ignore
  }
}

export function CurrencyProvider({
  children,
  settingsDefaultCurrency = DEFAULT_DISPLAY_CURRENCY,
}: {
  children: React.ReactNode;
  settingsDefaultCurrency?: string;
}) {
  const settingsDefault = (
    settingsDefaultCurrency || DEFAULT_DISPLAY_CURRENCY
  ).toUpperCase();
  const [country, setCountryState] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [currency, setCurrencyState] = useState<string>(DEFAULT_CURRENCY);
  const [hydrated, setHydrated] = useState(false);
  // Fetch immediately so cards/calculator never flash the static 11.19 fallback
  // (which would briefly show a different GHS amount than the live feed).
  const { ratesLoaded, ratesStale, meta: ratesMeta } = useExchangeRates({
    defer: false,
  });

  useEffect(() => {
    const initial = resolveInitialPreferences();
    setCountryState(initial.country);
    setCurrencyState(initial.currency);
    setHydrated(true);
  }, []);

  const setCountry = useCallback((next: CountryCode) => {
    const config = getCountryConfig(next);
    setCountryState(next);
    setCurrencyState(config.currency);
    persistPreferences(next, config.currency);
  }, []);

  const setCurrency = useCallback((next: string) => {
    const nextCountry = countryForCurrency(next);
    setCurrencyState(next);
    setCountryState(nextCountry);
    persistPreferences(nextCountry, next);
  }, []);

  const displayCountry = hydrated ? country : DEFAULT_COUNTRY;
  const displayCurrency = hydrated ? currency : DEFAULT_CURRENCY;

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
      settingsDefaultCurrency: settingsDefault,
      formatPrice,
      formatVehicleListPrice,
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
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }
  return ctx;
}
