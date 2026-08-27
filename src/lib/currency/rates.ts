/** Units of target currency per 1 USD */
export type ExchangeRateMap = Record<string, number>;

import { REFERENCE_CURRENCIES } from "./types";
import { parseBoolean } from "@/lib/platform/site-settings";

let liveRates: ExchangeRateMap | null = null;

/** Override live rates (e.g. after fetching /api/exchange-rates). */
export function setExchangeRates(rates: ExchangeRateMap): void {
  liveRates = { USD: 1, ...rates };
}

export function getActiveRates(): ExchangeRateMap {
  return liveRates ?? getStaticFallbackRates();
}

/**
 * Env-overridable emergency fallbacks — used ONLY when the live FX API is down
 * or omits a code. Defaults approximate mid-2026 mid-market (GHS ≈ 11.19).
 * Do not treat these as live rates; `/api/exchange-rates` is the source of truth.
 */
export function getStaticFallbackRates(): ExchangeRateMap {
  return {
    USD: 1,
    GHS: parseEnvRate(process.env.NEXT_PUBLIC_USD_TO_GHS, 11.19),
    ZWL: parseEnvRate(process.env.NEXT_PUBLIC_USD_TO_ZWL, 26.63),
    ZAR: parseEnvRate(process.env.NEXT_PUBLIC_USD_TO_ZAR, 15.94),
    NGN: parseEnvRate(process.env.NEXT_PUBLIC_USD_TO_NGN, 1351),
    KES: parseEnvRate(process.env.NEXT_PUBLIC_USD_TO_KES, 129.5),
    GBP: parseEnvRate(process.env.NEXT_PUBLIC_USD_TO_GBP, 0.73),
    EUR: parseEnvRate(process.env.NEXT_PUBLIC_USD_TO_EUR, 0.86),
    ...STATIC_FALLBACK_RATES,
  };
}

function parseEnvRate(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Approximate USD rates for currencies Frankfurter may omit.
 * Values are units of target per 1 USD.
 */
const STATIC_FALLBACK_RATES: ExchangeRateMap = {
  AFN: 70,
  ALL: 95,
  DZD: 134,
  AOA: 830,
  XCD: 2.7,
  ARS: 900,
  AMD: 390,
  AUD: 1.55,
  AZN: 1.7,
  BSD: 1,
  BHD: 0.38,
  BDT: 110,
  BBD: 2,
  BYN: 3.3,
  BZD: 2,
  XOF: 600,
  BTN: 84,
  BOB: 6.9,
  BAM: 1.8,
  BWP: 13.6,
  BRL: 5.1,
  BND: 1.35,
  BGN: 1.8,
  BIF: 2850,
  CVE: 102,
  KHR: 4100,
  XAF: 600,
  CAD: 1.36,
  CLP: 950,
  CNY: 7.25,
  COP: 4100,
  KMF: 450,
  CDF: 2800,
  NZD: 1.65,
  CRC: 520,
  CUP: 24,
  CZK: 23,
  DKK: 6.9,
  DJF: 178,
  DOP: 59,
  EGP: 49,
  ERN: 15,
  SZL: 18.5,
  ETB: 57,
  FJD: 2.25,
  GMD: 68,
  GEL: 2.7,
  GTQ: 7.8,
  GNF: 8600,
  GYD: 209,
  HTG: 132,
  HNL: 24.7,
  HUF: 365,
  ISK: 138,
  INR: 84,
  IDR: 15800,
  IRR: 42000,
  ILS: 3.7,
  JMD: 156,
  JPY: 150,
  JOD: 0.71,
  KZT: 480,
  KPW: 900,
  KRW: 1350,
  KWD: 0.31,
  KGS: 87,
  LAK: 21500,
  LBP: 89000,
  LSL: 18.5,
  LRD: 195,
  LYD: 4.85,
  CHF: 0.88,
  MGA: 4500,
  MWK: 1730,
  MYR: 4.45,
  MVR: 15.4,
  MDL: 18,
  MNT: 3400,
  MAD: 10,
  MZN: 64,
  MMK: 2100,
  NAD: 18.5,
  NPR: 134,
  NIO: 36.7,
  MKD: 57,
  NOK: 10.8,
  OMR: 0.38,
  PKR: 278,
  PAB: 1,
  PGK: 3.9,
  PYG: 7500,
  PEN: 3.75,
  PHP: 56,
  PLN: 4,
  QAR: 3.64,
  RUB: 95,
  RWF: 1350,
  RSD: 108,
  SCR: 14,
  SLE: 22,
  SGD: 1.34,
  SBD: 8.4,
  SOS: 570,
  SSP: 1300,
  LKR: 295,
  SDG: 600,
  SRD: 35,
  SEK: 10.6,
  SYP: 13000,
  TWD: 32,
  TJS: 10.9,
  TZS: 2650,
  THB: 34,
  TOP: 2.35,
  TTD: 6.8,
  TND: 3.1,
  TRY: 34,
  TMT: 3.5,
  UGX: 3700,
  UAH: 41,
  AED: 3.67,
  UYU: 42,
  UZS: 12700,
  VUV: 119,
  VES: 45,
  VND: 25000,
  YER: 250,
  ZMW: 27,
};

export const FX_OVERRIDE_CURRENCIES = REFERENCE_CURRENCIES.filter((c) => c !== "USD");

export function parseManualRatesJson(value: string | undefined): Record<string, number> {
  if (!value?.trim()) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [code, rate] of Object.entries(parsed)) {
      const n = Number(rate);
      if (Number.isFinite(n) && n > 0) out[code.toUpperCase()] = n;
    }
    return out;
  } catch {
    return {};
  }
}

export function isDisplayOverrideActive(settings: {
  fx_use_live_rates?: string;
  fx_manual_rates_json?: string;
}): boolean {
  if (parseBoolean(settings.fx_use_live_rates, true)) return false;
  const manualRates = parseManualRatesJson(settings.fx_manual_rates_json);
  return Boolean(manualRates.GHS && manualRates.GHS > 0);
}
