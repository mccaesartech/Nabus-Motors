import { BadgeCheck, Sparkles } from "lucide-react";
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

interface NabusCarTileProps {
  vehicle: Vehicle;
  className?: string;
  layout?: "grid" | "rail" | "featured-large" | "featured-small";
  showMeta?: boolean;
  showRemoveAction?: boolean;
  onSaveToggle?: (action: "saved" | "removed") => void;
}

function TileBadge({ vehicle }: { vehicle: Vehicle }) {
  if (vehicle.featured) {
    return (
      <span className="inline-flex items-center gap-1 border border-[var(--nabus-gold)]/40 bg-[var(--nabus-gold-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--nabus-graphite)]">
        <Sparkles className="size-3" />
        Select
      </span>
    );
  }
  if (vehicle.availableLocally) {
    return <LocalAvailabilityBadge available compact />;
  }
  if (
    activeTrustBadges(vehicle.trustBadges ?? DEFAULT_TRUST_BADGES).length > 0
  ) {
    return (
      <span className="inline-flex items-center gap-1 border border-[var(--nabus-border)] bg-[var(--nabus-paper)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--nabus-wine)]">
        <BadgeCheck className="size-3" />
        Verified
      </span>
    );
  }
  return null;
}

export function NabusCarTile({
  vehicle,
  className,
  layout = "grid",
  showMeta = true,
  showRemoveAction = false,
  onSaveToggle,
}: NabusCarTileProps) {
  const showPreorder = isPreOrderStatus(vehicle.status);
  const photo = primaryPhotoFor(vehicle);
  const detailHref = ROUTES.auto.inventoryDetail(vehicle.slug);

  const aspectClass =
    layout === "featured-large"
      ? "aspect-[16/10] sm:aspect-[5/3]"
      : layout === "featured-small"
        ? "aspect-[4/3]"
        : layout === "rail"
          ? "aspect-[16/11]"
          : "aspect-[4/3]";

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col bg-transparent transition-colors duration-200",
        className
      )}
    >
      <div className={cn("relative overflow-hidden bg-[var(--nabus-ivory)]", aspectClass)}>
        <VehicleCardTrackedLink
          href={detailHref}
          vehicle={vehicle}
          className="block h-full overflow-hidden"
        >
          <SafeVehicleImage
            src={photo}
            alt={formatVehicleName(vehicle)}
            className="vehicle-card-image h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
          />
        </VehicleCardTrackedLink>
        <div className="absolute left-0 top-0 flex max-w-[calc(100%-3.5rem)] flex-col gap-1.5 p-3">
          <NabusStatusChip status={vehicle.status ?? "available"} />
          <TileBadge vehicle={vehicle} />
        </div>
        <VehicleCardOverlayActions vehicle={vehicle} />
      </div>

      <div className={cn("flex flex-1 flex-col pt-4", layout === "rail" && "pt-3")}>
        <VehicleCardTrackedLink href={detailHref} vehicle={vehicle} className="group/link block">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-[var(--nabus-graphite)] transition-colors duration-200 group-hover/link:text-[var(--nabus-wine)]">
            {formatVehicleName(vehicle)}
          </h3>
        </VehicleCardTrackedLink>

        <div className="mt-2 flex items-baseline justify-between gap-2">
          <VehicleCardPrice
            vehicle={vehicle}
            className="text-lg font-semibold tabular-nums text-[var(--nabus-graphite)]"
          />
        </div>

        {showPreorder ? <VehicleCardPreorderNote vehicle={vehicle} /> : null}

        {showMeta ? (
          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-wide text-[var(--nabus-muted)]">
            <div>
              <dt className="sr-only">Year</dt>
              <dd>{vehicle.year}</dd>
            </div>
            <div>
              <dt className="sr-only">Mileage</dt>
              <dd>{formatMileage(vehicle.mileage)}</dd>
            </div>
            <div>
              <dt className="sr-only">Transmission</dt>
              <dd>{vehicle.transmission}</dd>
            </div>
            {vehicle.id ? (
              <div className="hidden sm:block">
                <dt className="sr-only">Stock</dt>
                <dd>#{vehicle.id.slice(0, 8).toUpperCase()}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {showRemoveAction ? (
          <VehicleCardFooter
            vehicle={vehicle}
            detailHref={detailHref}
            showPreorder={showPreorder}
            showRemoveAction
            onSaveToggle={onSaveToggle}
          />
        ) : null}
      </div>
    </article>
  );
}

/** @deprecated Use NabusCarTile */
export const NabusVehicleCard = NabusCarTile;
