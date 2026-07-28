"use client";

import { useCurrency } from "@/context/currency-context";
import { cn } from "@/lib/utils";
import type { VehiclePriceFields } from "@/lib/currency";

interface VehiclePriceProps {
  /** @deprecated Prefer `vehicle` for listing-currency-aware display. */
  usdAmount?: number;
  vehicle?: VehiclePriceFields;
  className?: string;
}

export function VehiclePrice({ usdAmount, vehicle, className }: VehiclePriceProps) {
  const { formatPrice, formatVehicleListPrice } = useCurrency();
  const text = vehicle
    ? formatVehicleListPrice(vehicle)
    : formatPrice(usdAmount ?? 0);
  return <span className={cn("tabular-nums", className)}>{text}</span>;
}
