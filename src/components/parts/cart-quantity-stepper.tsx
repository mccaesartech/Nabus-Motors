"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CartQuantityStepperProps = {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  min?: number;
  max?: number;
  className?: string;
  size?: "sm" | "default";
};

export function CartQuantityStepper({
  quantity,
  onDecrease,
  onIncrease,
  min = 1,
  max,
  className,
  size = "sm",
}: CartQuantityStepperProps) {
  const iconSize = size === "sm" ? "size-8" : "size-9";
  const iconClass = size === "sm" ? "size-3.5" : "size-4";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={iconSize}
        aria-label="Decrease quantity"
        onClick={onDecrease}
        disabled={quantity <= min}
      >
        <Minus className={iconClass} />
      </Button>
      <span
        className={cn(
          "text-center font-medium tabular-nums",
          size === "sm" ? "w-8 text-sm" : "w-10 text-base"
        )}
      >
        {quantity}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={iconSize}
        aria-label="Increase quantity"
        onClick={onIncrease}
        disabled={max != null && quantity >= max}
      >
        <Plus className={iconClass} />
      </Button>
    </div>
  );
}
