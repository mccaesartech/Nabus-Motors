import Link from "next/link";
import type { Vehicle } from "@/lib/types";
import { formatVehicleName } from "@/lib/format";
import { primaryPhotoFor } from "@/lib/data/vehicle-images";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { VehiclePrice } from "@/components/shared/vehicle-price";
import { FoldIndex } from "@/components/fold/fold-primitives";
import { ROUTES } from "@/lib/routes";

type FoldDealProps = {
  vehicle?: Vehicle;
};

export function FoldDeal({ vehicle }: FoldDealProps) {
  if (!vehicle) return null;

  return (
    <section className="overflow-hidden bg-[var(--nabus-ivory)]">
      <div className="grid lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
        <div className="flex flex-col justify-center px-4 py-16 sm:px-8 lg:px-12 xl:px-16">
          <FoldIndex n="08" />
          <p className="mt-4 font-mono text-[11px] tracking-[0.16em] uppercase text-[var(--nabus-wine)]">
            One deal
          </p>
          <h2 className="font-display mt-3 text-[clamp(1.9rem,4vw,3.2rem)] leading-[1.08] text-[var(--nabus-graphite)]">
            {formatVehicleName(vehicle)}
          </h2>
          {vehicle.description ? (
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--nabus-muted)] line-clamp-4">
              {vehicle.description}
            </p>
          ) : null}
          <p className="mt-6 text-2xl tabular-nums text-[var(--nabus-graphite)]">
            <VehiclePrice vehicle={vehicle} />
          </p>
          <Link
            href={ROUTES.auto.inventoryDetail(vehicle.slug)}
            className="mt-8 inline-flex text-[14px] text-[var(--nabus-wine)] underline decoration-[var(--nabus-wine)]/30 underline-offset-8 hover:decoration-[var(--nabus-wine)]"
          >
            Reserve this car
          </Link>
        </div>
        <Link
          href={ROUTES.auto.inventoryDetail(vehicle.slug)}
          className="relative min-h-[52vw] overflow-hidden bg-[var(--nabus-graphite)] lg:min-h-[36rem]"
        >
          <SafeVehicleImage
            src={primaryPhotoFor(vehicle)}
            alt={formatVehicleName(vehicle)}
            className="h-full w-full object-cover"
          />
        </Link>
      </div>
    </section>
  );
}
