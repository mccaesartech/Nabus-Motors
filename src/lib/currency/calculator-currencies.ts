import { COUNTRIES } from "@/lib/countries";
import { REFERENCE_CURRENCIES } from "./types";
import { getCurrencyLabel } from "./names";

/** Unique ISO currency codes for the converter picker - reference currencies first. */
export function getCalculatorCurrencies(): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const code of REFERENCE_CURRENCIES) {
    if (!seen.has(code)) {
      seen.add(code);
      ordered.push(code);
    }
  }

  const rest = [...new Set(COUNTRIES.map((c) => c.currency))]
    .filter((code) => !seen.has(code))
    .sort((a, b) => a.localeCompare(b));

  return [...ordered, ...rest];
}

export function currencyOptionLabel(code: string): string {
  return `${code} - ${getCurrencyLabel(code)}`;
}
