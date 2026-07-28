import { BadgeCheck, Fuel, Gauge, MapPin } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { formatMileage, formatVehicleName } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { AvailabilityBadge } from "@/components/vehicle/availability-badge";
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

function CardSecondaryBadge({ vehicle }: { vehicle: Vehicle }) {
  if (vehicle.featured) {
    return <Badge variant="featured">Featured</Badge>;
  }

  if (vehicle.availableLocally) {
    return <LocalAvailabilityBadge available compact />;
  }

  const hasTrustBadges = activeTrustBadges(
    vehicle.trustBadges ?? DEFAULT_TRUST_BADGES
  ).length > 0;

  if (hasTrustBadges) {
    return (
      <Badge variant="verified" className="gap-1">
        <BadgeCheck className="size-3" />
        Verified
      </Badge>
    );
  }

  return null;
}

export function VehicleCard({
  vehicle,
  className,
  showRemoveAction = false,
  onSaveToggle,
}: VehicleCardProps) {
  const premium = isPremiumVehicle(vehicle);
  const showPreorder = isPreOrderStatus(vehicle.status);
  const photo = primaryPhotoFor(vehicle);
  const detailHref = ROUTES.auto.inventoryDetail(vehicle.slug);

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-lg border bg-card shadow-luxury transition-all duration-300 hover:shadow-luxury-lg",
        premium
          ? "border-foreground/20 hover:border-foreground/40"
          : "border-border hover:border-foreground/20",
        className
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <VehicleCardTrackedLink
          href={detailHref}
          vehicle={vehicle}
          className="block overflow-hidden"
        >
          <SafeVehicleImage
            src={photo}
            alt={formatVehicleName(vehicle)}
            className="vehicle-card-image transition-transform duration-500 ease-out group-hover:scale-[1.02]"
          />
        </VehicleCardTrackedLink>
        <div className="absolute left-3 top-3 flex max-w-[calc(100%-4rem)] flex-col gap-1.5">
          <AvailabilityBadge status={vehicle.status ?? "available"} />
          <CardSecondaryBadge vehicle={vehicle} />
        </div>
        <VehicleCardOverlayActions vehicle={vehicle} />
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <VehicleCardTrackedLink
          href={detailHref}
          vehicle={vehicle}
          className="group/link block"
        >
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground transition-colors duration-200 group-hover/link:text-brand-purple">
            {formatVehicleName(vehicle)}
          </h3>
        </VehicleCardTrackedLink>

        <div className="mt-2.5 flex items-baseline justify-between">
          <VehicleCardPrice
            vehicle={vehicle}
            className="text-lg font-semibold tabular-nums text-foreground"
          />
        </div>

        {showPreorder && <VehicleCardPreorderNote vehicle={vehicle} />}

        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Gauge className="size-3 shrink-0 text-muted-foreground" />
            {formatMileage(vehicle.mileage)}
          </span>
          <span className="flex items-center gap-1.5">
            <Fuel className="size-3 shrink-0 text-muted-foreground" />
            {vehicle.fuelType}
          </span>
          <span className="col-span-2 flex items-center gap-1.5 truncate">
            <MapPin className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate">{vehicle.location}</span>
          </span>
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
