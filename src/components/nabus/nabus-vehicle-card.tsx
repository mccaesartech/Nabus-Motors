import { BadgeCheck, Fuel, Gauge, MapPin, Sparkles } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { formatMileage, formatVehicleName } from "@/lib/format";
import { primaryPhotoFor } from "@/lib/data/vehicle-images";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { LocalAvailabilityBadge } from "@/components/vehicle/local-availability-badge";
import { ROUTES } from "@/lib/routes";
import {
  activeTrustBadges,
  DEFAULT_TRUST_BADGES,
} from "@/lib/vehicles/trust-badges";
import { isPreOrderStatus } from "@/lib/vehicles/availability";
import {
  VehicleCardFooter,
  VehicleCardOverlayActions,
  VehicleCardPreorderNote,
  VehicleCardPrice,
  VehicleCardTrackedLink,
} from "@/components/shared/vehicle-card-client";
import { NabusStatusChip } from "@/components/nabus/nabus-status-chip";
import { cn } from "@/lib/utils";

interface NabusVehicleCardProps {
  vehicle: Vehicle;
  className?: string;
  compact?: boolean;
  showRemoveAction?: boolean;
  onSaveToggle?: (action: "saved" | "removed") => void;
}

function CardAccentBadge({ vehicle }: { vehicle: Vehicle }) {
  if (vehicle.featured) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--nabus-yellow-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--nabus-charcoal)] border border-[var(--nabus-yellow)]/30">
        <Sparkles className="size-3" />
        Featured
      </span>
    );
  }

  if (vehicle.availableLocally) {
    return <LocalAvailabilityBadge available compact />;
  }

  const hasTrustBadges = activeTrustBadges(
    vehicle.trustBadges ?? DEFAULT_TRUST_BADGES
  ).length > 0;

  if (hasTrustBadges) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--nabus-red-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--nabus-primary)]">
        <BadgeCheck className="size-3" />
        Verified
      </span>
    );
  }

  return null;
}

export function NabusVehicleCard({
  vehicle,
  className,
  compact = false,
  showRemoveAction = false,
  onSaveToggle,
}: NabusVehicleCardProps) {
  const showPreorder = isPreOrderStatus(vehicle.status);
  const photo = primaryPhotoFor(vehicle);
  const detailHref = ROUTES.auto.inventoryDetail(vehicle.slug);

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border border-[var(--nabus-border)] bg-[var(--nabus-surface)] transition-all duration-200 hover:border-[var(--nabus-primary)]/25 hover:shadow-[0_4px_20px_rgba(24,24,24,0.06)]",
        className
      )}
    >
      <div className={cn("relative overflow-hidden bg-[var(--nabus-background)]", compact ? "aspect-[16/10]" : "aspect-[4/3]")}>
        <VehicleCardTrackedLink
          href={detailHref}
          vehicle={vehicle}
          className="block h-full overflow-hidden"
        >
          <SafeVehicleImage
            src={photo}
            alt={formatVehicleName(vehicle)}
            className="vehicle-card-image h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
        </VehicleCardTrackedLink>
        <div className="absolute left-3 top-3 flex max-w-[calc(100%-4rem)] flex-col gap-1.5">
          <NabusStatusChip status={vehicle.status ?? "available"} />
          <CardAccentBadge vehicle={vehicle} />
        </div>
        <VehicleCardOverlayActions vehicle={vehicle} />
      </div>

      <div className={cn("flex flex-1 flex-col", compact ? "p-3.5" : "p-4 sm:p-5")}>
        <VehicleCardTrackedLink
          href={detailHref}
          vehicle={vehicle}
          className="group/link block"
        >
          <h3
            className={cn(
              "line-clamp-2 font-semibold leading-snug text-[var(--nabus-charcoal)] transition-colors duration-200 group-hover/link:text-[var(--nabus-primary)]",
              compact ? "text-sm" : "text-[15px]"
            )}
          >
            {formatVehicleName(vehicle)}
          </h3>
        </VehicleCardTrackedLink>

        <div className="mt-2 flex items-baseline justify-between">
          <VehicleCardPrice
            vehicle={vehicle}
            className={cn(
              "font-bold tabular-nums text-[var(--nabus-charcoal)]",
              compact ? "text-base" : "text-lg"
            )}
          />
        </div>

        {showPreorder && <VehicleCardPreorderNote vehicle={vehicle} />}

        <div
          className={cn(
            "mt-3 grid gap-y-1 text-xs text-[var(--nabus-text-secondary)]",
            compact ? "grid-cols-1 gap-1" : "grid-cols-2 gap-x-3 gap-y-1.5"
          )}
        >
          <span className="flex items-center gap-1.5">
            <Gauge className="size-3 shrink-0" />
            {formatMileage(vehicle.mileage)}
          </span>
          <span className="flex items-center gap-1.5">
            <Fuel className="size-3 shrink-0" />
            {vehicle.fuelType}
          </span>
          {!compact ? (
            <span className="col-span-2 flex items-center gap-1.5 truncate">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{vehicle.location}</span>
            </span>
          ) : null}
        </div>

        <VehicleCardFooter
          vehicle={vehicle}
          detailHref={detailHref}
          showPreorder={showPreorder}
          showRemoveAction={showRemoveAction}
          onSaveToggle={onSaveToggle}
        />
      </div>
    </article>
  );
}
