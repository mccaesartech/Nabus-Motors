import type { Vehicle } from "@/lib/types";
import { formatMileage, formatVehicleName } from "@/lib/format";
import { primaryPhotoFor } from "@/lib/data/vehicle-images";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { ROUTES } from "@/lib/routes";
import { isPreOrderStatus } from "@/lib/vehicles/availability";
import {
  VehicleCardFooter,
  VehicleCardOverlayActions,
  VehicleCardPreorderNote,
  VehicleCardPrice,
  VehicleCardTrackedLink,
} from "@/components/shared/vehicle-card-client";
import { cn } from "@/lib/utils";

interface FoldCarTileProps {
  vehicle: Vehicle;
  className?: string;
  layout?: "grid" | "rail" | "featured-large" | "featured-small" | "bleed";
  showMeta?: boolean;
  showRemoveAction?: boolean;
  onSaveToggle?: (action: "saved" | "removed") => void;
}

export function FoldCarTile({
  vehicle,
  className,
  layout = "grid",
  showMeta = true,
  showRemoveAction = false,
  onSaveToggle,
}: FoldCarTileProps) {
  const showPreorder = isPreOrderStatus(vehicle.status);
  const photo = primaryPhotoFor(vehicle);
  const detailHref = ROUTES.auto.inventoryDetail(vehicle.slug);

  const aspectClass =
    layout === "featured-large" || layout === "bleed"
      ? "aspect-[16/10] sm:aspect-[5/3]"
      : layout === "featured-small"
        ? "aspect-[4/3]"
        : layout === "rail"
          ? "aspect-[16/10]"
          : "aspect-[4/3]";

  return (
    <article className={cn("group relative flex h-full flex-col bg-transparent", className)}>
      <div className={cn("relative overflow-hidden bg-[var(--nabus-ivory)]", aspectClass)}>
        <VehicleCardTrackedLink href={detailHref} vehicle={vehicle} className="block h-full overflow-hidden">
          <SafeVehicleImage
            src={photo}
            alt={formatVehicleName(vehicle)}
            className="vehicle-card-image h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        </VehicleCardTrackedLink>
        <VehicleCardOverlayActions vehicle={vehicle} />
      </div>

      <div className={cn("flex flex-1 flex-col pt-3", layout === "rail" && "pt-2.5")}>
        <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-[var(--nabus-muted)]">
          {vehicle.availableLocally ? "In Ghana" : showPreorder ? "Import" : vehicle.status ?? "Available"}
          {vehicle.id ? `  ${vehicle.id.slice(0, 7).toUpperCase()}` : ""}
        </p>
        <VehicleCardTrackedLink href={detailHref} vehicle={vehicle} className="mt-1 block">
          <h3 className="font-display line-clamp-2 text-[1.15rem] leading-[1.2] text-[var(--nabus-graphite)] transition-colors duration-200 group-hover:text-[var(--nabus-wine)]">
            {formatVehicleName(vehicle)}
          </h3>
        </VehicleCardTrackedLink>

        <div className="mt-2">
          <VehicleCardPrice
            vehicle={vehicle}
            className="text-base font-medium tabular-nums text-[var(--nabus-graphite)]"
          />
        </div>

        {showPreorder ? <VehicleCardPreorderNote vehicle={vehicle} /> : null}

        {showMeta ? (
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-wide text-[var(--nabus-muted)]">
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
