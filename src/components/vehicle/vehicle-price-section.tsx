"use client";

import { useCurrency } from "@/context/currency-context";
import {
  formatVehiclePrice,
  getCurrencyLabel,
  REFERENCE_CURRENCIES,
  type VehiclePriceFields,
} from "@/lib/currency";

interface VehiclePriceSectionProps {
  /** @deprecated Prefer `vehicle` for listing-currency-aware display. */
  usdAmount?: number;
  vehicle?: VehiclePriceFields;
}

export function VehiclePriceSection({
  usdAmount,
  vehicle,
}: VehiclePriceSectionProps) {
  const { currency, formatPrice, formatVehicleListPrice } = useCurrency();
  const otherCurrencies = REFERENCE_CURRENCIES.filter((c) => c !== currency);
  const fields: VehiclePriceFields = vehicle ?? {
    price: usdAmount ?? 0,
    priceCurrency: "USD",
    listedPrice: usdAmount ?? 0,
  };
  const primary = vehicle
    ? formatVehicleListPrice(vehicle)
    : formatPrice(usdAmount ?? 0);

  return (
    <div>
      <p className="text-3xl font-semibold tabular-nums text-foreground">
        {primary}
      </p>
      {otherCurrencies.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {otherCurrencies.map((code) => (
            <li key={code}>
              ≈ {formatVehiclePrice(fields, code)}{" "}
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
