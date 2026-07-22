"use client";

import { useCurrency } from "@/context/currency-context";
import {
  formatUsdPrice,
  getCurrencyLabel,
  REFERENCE_CURRENCIES,
} from "@/lib/currency";

interface VehiclePriceSectionProps {
  usdAmount: number;
}

export function VehiclePriceSection({ usdAmount }: VehiclePriceSectionProps) {
  const { currency, formatPrice } = useCurrency();
  const otherCurrencies = REFERENCE_CURRENCIES.filter((c) => c !== currency);

  return (
    <div>
      <p className="text-3xl font-semibold tabular-nums text-foreground">
        {formatPrice(usdAmount)}
      </p>
      {otherCurrencies.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {otherCurrencies.map((code) => (
            <li key={code}>
              ≈ {formatUsdPrice(usdAmount, code)}{" "}
              <span className="text-muted-foreground/70">
                ({getCurrencyLabel(code)})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
