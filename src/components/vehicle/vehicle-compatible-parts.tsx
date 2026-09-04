import { Package, ArrowRight } from "lucide-react";
import { FullPageLink } from "@/components/shared/full-page-link";
import { ROUTES } from "@/lib/routes";
import type { Vehicle } from "@/lib/types";

type VehicleCompatiblePartsProps = {
  vehicle: Vehicle;
};

export function VehicleCompatibleParts({ vehicle }: VehicleCompatiblePartsProps) {
  const params = new URLSearchParams({ make: vehicle.make });
  if (vehicle.model?.trim()) {
    params.set("model", vehicle.model.trim());
  }
  const partsHref = `${ROUTES.auto.spareParts}?${params.toString()}`;

  return (
    <div className="mt-10 rounded-xl border border-border/70 bg-muted/20 p-6">
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-icon-box-border bg-icon-box-bg">
          <Package className="size-5 text-icon-box-fg" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">Compatible Spare Parts</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Source genuine parts for your {vehicle.make} {vehicle.model} through Nabus Motors.
            Browse our catalog filtered for {vehicle.make}
            {vehicle.model ? ` ${vehicle.model}` : ""} compatibility.
          </p>
          <FullPageLink
            href={partsHref}
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-purple hover:underline"
          >
            Browse parts for {vehicle.make}
            <ArrowRight className="size-4" />
          </FullPageLink>
        </div>
      </div>
    </div>
  );
}
