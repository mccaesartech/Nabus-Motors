import { getCurrencyLabel } from "@/lib/currency/names";
import { COUNTRIES_DATA } from "@/lib/countries-data";

export const COUNTRIES = COUNTRIES_DATA;

export type CountryCode = (typeof COUNTRIES)[number]["code"];

export type CountryConfig = (typeof COUNTRIES)[number];

export const COUNTRY_CODES: CountryCode[] = COUNTRIES.map((c) => c.code);

export const DEFAULT_COUNTRY: CountryCode = "GH";

const countryByCode = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c])
) as Record<CountryCode, CountryConfig>;

/** Preferred country when multiple share the same currency */
const PREFERRED_COUNTRY_BY_CURRENCY: Record<string, CountryCode> = {
  GHS: "GH",
  USD: "US",
  EUR: "DE",
  GBP: "GB",
  ZAR: "ZA",
  NGN: "NG",
  KES: "KE",
  ZWL: "ZW",
};

const primaryCountryByCurrency = (() => {
  const map: Record<string, CountryCode> = { ...PREFERRED_COUNTRY_BY_CURRENCY };
  for (const country of COUNTRIES) {
    if (!map[country.currency]) {
      map[country.currency] = country.code;
    }
  }
  return map;
})();

export function getCountryConfig(code: CountryCode): CountryConfig {
  return countryByCode[code];
}

export function countryForCurrency(currency: string): CountryCode {
  return primaryCountryByCurrency[currency] ?? DEFAULT_COUNTRY;
}

export function countryOptionLabel(country: CountryConfig): string {
  const label = getCurrencyLabel(country.currency);
  return `${country.name} — ${country.currency} (${label})`;
}

export function countryTriggerLabel(country: CountryConfig): string {
  return `${country.name} · ${country.currency}`;
}
