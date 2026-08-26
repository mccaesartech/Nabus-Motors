import { BASE_CURRENCY } from "./types";
import { assertCurrencyCode, ConversionCodeError, normalizeCurrencyCode } from "./codes";
import { getActiveRates, type ExchangeRateMap } from "./rates";

export class ConversionError extends Error {
  readonly code: "invalid_code" | "invalid_amount" | "missing_rate";

  constructor(
    code: "invalid_code" | "invalid_amount" | "missing_rate",
    message: string
  ) {
    super(message);
    this.name = "ConversionError";
    this.code = code;
  }
}

export type ConversionResult = {
  sourceCurrency: string;
  targetCurrency: string;
  originalAmount: number;
  convertedAmount: number;
  /** Units of target per 1 unit of source (via USD pivot). */
  rate: number;
  roundedAmount: number;
};

export type ConvertOptions = {
  rates?: ExchangeRateMap;
};

function requireFiniteAmount(amount: number): number {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new ConversionError("invalid_amount", "Amount must be a finite number.");
  }
  return amount;
}

export function roundMoney(amount: number): number {
  return Math.round(amount);
}

export function roundRate(rate: number): number {
  return Math.round(rate * 1e8) / 1e8;
}

function usdPerUnit(code: string, rates: ExchangeRateMap): number {
  if (code === BASE_CURRENCY) return 1;
  const rate = rates[code];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new ConversionError(
      "missing_rate",
      `No exchange rate is available for ${code}.`
    );
  }
  return rate;
}

/** Units of `toCurrency` per 1 unit of `fromCurrency` (via USD pivot). */
export function quotedRate(
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRateMap = getActiveRates()
): number {
  let from: string;
  let to: string;
  try {
    from = assertCurrencyCode(fromCurrency);
    to = assertCurrencyCode(toCurrency);
  } catch (error) {
    throw new ConversionError(
      "invalid_code",
      error instanceof Error ? error.message : "Invalid currency code."
    );
  }

  if (from === to) return 1;
  return roundRate(usdPerUnit(to, rates) / usdPerUnit(from, rates));
}

/**
 * Convert `amount` from `fromCurrency` to `toCurrency`.
 * Throws ConversionError for invalid codes, amounts, or missing rates.
 */
export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  options: ConvertOptions = {}
): ConversionResult {
  const originalAmount = requireFiniteAmount(amount);
  const rates = options.rates ?? getActiveRates();

  let from: string;
  let to: string;
  try {
    from = assertCurrencyCode(fromCurrency);
    to = assertCurrencyCode(toCurrency);
  } catch (error) {
    throw new ConversionError(
      "invalid_code",
      error instanceof Error ? error.message : "Invalid currency code."
    );
  }

  const rate = quotedRate(from, to, rates);
  const convertedAmount = originalAmount * rate;
  return {
    sourceCurrency: from,
    targetCurrency: to,
    originalAmount,
    convertedAmount,
    rate,
    roundedAmount: roundMoney(convertedAmount),
  };
}

export function tryConvertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  options: ConvertOptions = {}
): ConversionResult | null {
  try {
    return convertAmount(amount, fromCurrency, toCurrency, options);
  } catch {
    return null;
  }
}

export function convertMany(
  amount: number,
  fromCurrency: string,
  targets: readonly string[],
  options: ConvertOptions = {}
): ConversionResult[] {
  return targets.map((target) =>
    convertAmount(amount, fromCurrency, target, options)
  );
}

export function convertFromUsd(
  usdAmount: number,
  target: string,
  rates: ExchangeRateMap = getActiveRates()
): number {
  const code = normalizeCurrencyCode(target) || BASE_CURRENCY;
  if (code === BASE_CURRENCY) return usdAmount;
  const result = tryConvertAmount(usdAmount, BASE_CURRENCY, code, { rates });
  return result ? result.convertedAmount : usdAmount;
}

export function convertToUsd(
  amount: number,
  fromCurrency: string,
  rates: ExchangeRateMap = getActiveRates()
): number {
  const code = normalizeCurrencyCode(fromCurrency) || BASE_CURRENCY;
  if (code === BASE_CURRENCY) return amount;
  const result = tryConvertAmount(amount, code, BASE_CURRENCY, { rates });
  return result ? result.convertedAmount : amount;
}

export function convertBetweenCurrencies(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRateMap = getActiveRates()
): number {
  const result = tryConvertAmount(amount, fromCurrency, toCurrency, { rates });
  return result ? result.convertedAmount : amount;
}

/** Display-safe cross rate. Returns 1 when a code is missing (storefront fallback). */
export function getCrossRate(
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRateMap = getActiveRates()
): number {
  try {
    return quotedRate(fromCurrency, toCurrency, rates);
  } catch (error) {
    if (error instanceof ConversionError || error instanceof ConversionCodeError) {
      return 1;
    }
    throw error;
  }
}
