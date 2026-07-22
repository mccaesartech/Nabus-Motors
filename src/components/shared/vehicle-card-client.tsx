"use client";

import { Heart } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { formatVehicleName } from "@/lib/format";
import { VehiclePrice } from "@/components/shared/vehicle-price";
import { PreorderForm } from "@/components/vehicle/preorder-form";
import { AddVehicleToCartButton } from "@/components/vehicle/add-vehicle-to-cart-button";
import Link from "next/link";
import { useGarage } from "@/hooks/use-garage";
import { recordVehicleEngagement } from "@/lib/vehicle-preferences";
import { useCurrency } from "@/context/currency-context";
import { downPaymentUsd } from "@/lib/vehicles/availability";
import { AddToCompareButton } from "@/components/vehicle/add-to-compare-button";
import { cn } from "@/lib/utils";

type VehicleCardOverlayActionsProps = {
  vehicle: Vehicle;
};

export function VehicleCardOverlayActions({ vehicle }: VehicleCardOverlayActionsProps) {
  const { isSavedVehicle, toggleSave } = useGarage();
  const saved = isSavedVehicle(vehicle);

  function handleSaveToggle() {
    const action = toggleSave(vehicle);
    if (action === "saved") {
      recordVehicleEngagement("save", vehicle);
    }
  }

  return (
    <div className="absolute right-3 top-3 flex flex-col gap-2">
      <AddToCompareButton
        vehicle={vehicle}
        variant="icon"
        onToggle={(action) => {
          if (action === "full") {
            window.alert("Compare list is full (max 4 vehicles). Remove one to add another.");
          }
        }}
      />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleSaveToggle();
        }}
        className={cn(
          "flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/95 shadow-luxury transition-colors duration-200 hover:bg-brand-purple/10",
          saved
            ? "text-brand-purple hover:text-brand-purple-dark"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label={saved ? "Remove from saved vehicles" : "Save vehicle"}
        aria-pressed={saved}
      >
        <Heart className={cn("size-4", saved && "fill-current")} />
      </button>
    </div>
  );
}

type VehicleCardTrackedLinkProps = {
  href: string;
  vehicle: Vehicle;
  className?: string;
  children: React.ReactNode;
};

export function VehicleCardTrackedLink({
  href,
  vehicle,
  className,
  children,
}: VehicleCardTrackedLinkProps) {
  return (
    <Link
      href={href}
      prefetch
      className={className}
      onClick={() => recordVehicleEngagement("click", vehicle)}
    >
      {children}
    </Link>
  );
}

type VehicleCardPreorderNoteProps = {
  vehicle: Vehicle;
};

export function VehicleCardPreorderNote({ vehicle }: VehicleCardPreorderNoteProps) {
  const { formatPrice } = useCurrency();

  return (
    <p className="mt-1.5 text-xs font-medium text-brand-purple">
      Down payment from {formatPrice(downPaymentUsd(vehicle.price))} (25%)
    </p>
  );
}

type VehicleCardFooterProps = {
  vehicle: Vehicle;
  detailHref: string;
  showPreorder: boolean;
  showRemoveAction?: boolean;
  onSaveToggle?: (action: "saved" | "removed") => void;
};

export function VehicleCardFooter({
  vehicle,
  detailHref,
  showPreorder,
  showRemoveAction = false,
  onSaveToggle,
}: VehicleCardFooterProps) {
  const { isSavedVehicle, toggleSave } = useGarage();
  const saved = isSavedVehicle(vehicle);

  function handleSaveToggle() {
    const action = toggleSave(vehicle);
    if (action === "saved") {
      recordVehicleEngagement("save", vehicle);
    }
    onSaveToggle?.(action);
  }

  return (
    <>
      <div className="mt-auto flex w-full flex-col gap-2 pt-4">
        <VehicleCardTrackedLink
          href={detailHref}
          vehicle={vehicle}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-brand-purple px-3 text-sm font-medium text-white transition-colors hover:bg-brand-purple-dark"
        >
          View Details
        </VehicleCardTrackedLink>
        <AddVehicleToCartButton
          vehicle={vehicle}
          variant="outline"
          className="h-10 w-full"
        />
        {showPreorder && (
          <PreorderForm
            vehicle={vehicle}
            triggerLabel="Pre-Order"
            triggerClassName="w-full"
          />
        )}
      </div>

      {showRemoveAction && saved && (
        <button
          type="button"
          onClick={handleSaveToggle}
          className="mt-3 w-full text-center text-xs font-medium text-brand-purple transition-colors hover:text-brand-purple-dark"
        >
          Remove from saved
        </button>
      )}
    </>
  );
}

export function VehicleCardPrice({
  usdAmount,
  className,
}: {
  usdAmount: number;
  className?: string;
}) {
  return <VehiclePrice usdAmount={usdAmount} className={className} />;
}
