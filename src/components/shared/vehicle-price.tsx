"use client";

import { useCurrency } from "@/context/currency-context";
import { cn } from "@/lib/utils";

interface VehiclePriceProps {
  usdAmount: number;
  className?: string;
}

export function VehiclePrice({ usdAmount, className }: VehiclePriceProps) {
  const { formatPrice } = useCurrency();
  return <span className={cn("tabular-nums", className)}>{formatPrice(usdAmount)}</span>;
}
