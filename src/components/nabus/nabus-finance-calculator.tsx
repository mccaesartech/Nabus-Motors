"use client";

import { FinancingCalculator } from "@/components/vehicle/financing-calculator";
import { cn } from "@/lib/utils";

type NabusFinanceCalculatorProps = {
  price: number;
  className?: string;
  collapsible?: boolean;
  dark?: boolean;
};

export function NabusFinanceCalculator({
  price,
  className,
  collapsible = false,
  dark = false,
}: NabusFinanceCalculatorProps) {
  return (
    <div
      className={cn(
        dark ? "text-[var(--nabus-paper)]" : "text-[var(--nabus-graphite)]",
        "[&_.text-muted-foreground]:text-[var(--nabus-muted)]",
        "[&_[data-slot=slider-range]]:bg-[var(--nabus-gold)]",
        "[&_[data-slot=slider-thumb]]:border-[var(--nabus-gold)]",
        className
      )}
    >
      <FinancingCalculator price={price} collapsible={collapsible} />
    </div>
  );
}
