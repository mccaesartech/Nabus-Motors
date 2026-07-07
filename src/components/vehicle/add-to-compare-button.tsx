"use client";

import { ArrowRightLeft } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useCompare } from "@/hooks/use-compare";
import { trackVehicleInterest } from "@/lib/vehicle-interest/client";
import { cn } from "@/lib/utils";

interface AddToCompareButtonProps {
  vehicle: Vehicle;
  variant?: "icon" | "full";
  className?: string;
  onToggle?: (action: "added" | "removed" | "full") => void;
}

export function AddToCompareButton({
  vehicle,
  variant = "full",
  className,
  onToggle,
}: AddToCompareButtonProps) {
  const { isInCompare, toggleCompare } = useCompare();
  const inCompare = isInCompare(vehicle);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const action = toggleCompare(vehicle);
    if (action === "added") {
      trackVehicleInterest("compare", vehicle);
    }
    onToggle?.(action);
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex size-8 items-center justify-center rounded-full bg-white/95 shadow-luxury transition-colors duration-200 hover:bg-brand-purple/10",
          inCompare
            ? "text-brand-purple hover:text-brand-purple-dark"
            : "text-muted-foreground hover:text-foreground",
          className
        )}
        aria-label={inCompare ? "Remove from compare" : "Add to compare"}
        aria-pressed={inCompare}
      >
        <ArrowRightLeft className="size-4" />
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant={inCompare ? "outline" : "secondary"}
      className={cn(
        "w-full transition-colors",
        inCompare && "border-brand-purple/30 text-brand-purple hover:bg-brand-purple/10 hover:text-brand-purple-dark",
        className
      )}
      onClick={handleClick}
      aria-label={inCompare ? "Remove from compare" : "Add to compare"}
      aria-pressed={inCompare}
    >
      <ArrowRightLeft className="size-4" />
      {inCompare ? "Remove from Compare" : "Add to Compare"}
    </Button>
  );
}
