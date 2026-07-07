"use client";

import { Heart, Fuel, Gauge, MapPin } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { formatMileage, formatVehicleName } from "@/lib/format";
import { VehiclePrice } from "@/components/shared/vehicle-price";
import { Badge } from "@/components/ui/badge";
import { AvailabilityBadge } from "@/components/vehicle/availability-badge";
import { VehicleTrustBadges } from "@/components/vehicle/vehicle-trust-badges";
import { PreorderForm } from "@/components/vehicle/preorder-form";
import { AddVehicleToCartButton } from "@/components/vehicle/add-vehicle-to-cart-button";
import { primaryPhotoFor } from "@/lib/data/vehicle-images";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { FullPageLink } from "@/components/shared/full-page-link";
import { useGarage } from "@/hooks/use-garage";
import { recordVehicleEngagement } from "@/lib/vehicle-preferences";
import { useCurrency } from "@/context/currency-context";
import { downPaymentUsd, isPreOrderStatus } from "@/lib/vehicles/availability";
import { DEFAULT_TRUST_BADGES } from "@/lib/vehicles/trust-badges";
import { AddToCompareButton } from "@/components/vehicle/add-to-compare-button";
import { LocalAvailabilityBadge } from "@/components/vehicle/local-availability-badge";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface VehicleCardProps {
  vehicle: Vehicle;
  className?: string;
  /** Show explicit "Remove from saved" control (garage page). */
  showRemoveAction?: boolean;
  onSaveToggle?: (action: "saved" | "removed") => void;
}

function isPremiumVehicle(vehicle: Vehicle) {
  return (
    vehicle.featured ||
    vehicle.bodyType === "Luxury" ||
    vehicle.condition === "Certified Pre-Owned"
  );
}

export function VehicleCard({
  vehicle,
  className,
  showRemoveAction = false,
  onSaveToggle,
}: VehicleCardProps) {
  const { isSavedVehicle, toggleSave } = useGarage();
  const { formatPrice } = useCurrency();
  const saved = isSavedVehicle(vehicle);
  const premium = isPremiumVehicle(vehicle);
  const showPreorder = isPreOrderStatus(vehicle.status);
  const photo = primaryPhotoFor(vehicle);
  const detailHref = ROUTES.auto.inventoryDetail(vehicle.slug);

  function handleSaveToggle() {
    const action = toggleSave(vehicle);
    if (action === "saved") {
      recordVehicleEngagement("save", vehicle);
    }
    onSaveToggle?.(action);
  }

  function handleCardClick() {
    recordVehicleEngagement("click", vehicle);
  }

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden border bg-card shadow-luxury transition-all duration-300 hover:shadow-luxury-lg",
        premium
          ? "border-foreground/20 hover:border-foreground/40"
          : "border-border hover:border-foreground/20",
        className
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <FullPageLink href={detailHref} className="block overflow-hidden" onClick={handleCardClick}>
          <SafeVehicleImage
            src={photo}
            alt={formatVehicleName(vehicle)}
            className="transition-transform duration-500 ease-out group-hover:scale-[1.02]"
          />
        </FullPageLink>
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          <AvailabilityBadge status={vehicle.status ?? "available"} />
          <LocalAvailabilityBadge available={vehicle.availableLocally} />
          {vehicle.featured && <Badge variant="featured">Featured</Badge>}
          <VehicleTrustBadges
            badges={vehicle.trustBadges ?? DEFAULT_TRUST_BADGES}
            variant="card"
          />
        </div>
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
              "flex size-8 items-center justify-center rounded-full bg-white/95 shadow-luxury transition-colors duration-200 hover:bg-brand-purple/10",
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
      </div>

      <div className="flex flex-1 flex-col p-5">
        <FullPageLink href={detailHref} className="group/link block" onClick={handleCardClick}>
          <h3 className="text-[15px] font-semibold text-foreground transition-colors duration-200 group-hover/link:text-brand-purple">
            {formatVehicleName(vehicle)}
          </h3>
        </FullPageLink>

        <div className="mt-3 flex items-baseline justify-between">
          <VehiclePrice
            usdAmount={vehicle.price}
            className="text-lg font-semibold text-foreground"
          />
        </div>

        {showPreorder && (
          <p className="mt-2 text-xs font-medium text-brand-purple">
            Down payment from {formatPrice(downPaymentUsd(vehicle.price))} (25%)
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-x-2 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Gauge className="size-3 shrink-0 text-muted-foreground" />
            {formatMileage(vehicle.mileage)}
          </span>
          <span className="flex items-center gap-1.5">
            <Fuel className="size-3 shrink-0 text-muted-foreground" />
            {vehicle.fuelType}
          </span>
          <span className="col-span-2 flex items-center gap-1.5">
            <MapPin className="size-3 shrink-0 text-muted-foreground" />
            {vehicle.location}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <FullPageLink
              href={detailHref}
              className="inline-flex h-8 flex-1 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              onClick={handleCardClick}
            >
              View Details
            </FullPageLink>
            <AddVehicleToCartButton vehicle={vehicle} className="flex-1" />
          </div>
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
      </div>
    </article>
  );
}
