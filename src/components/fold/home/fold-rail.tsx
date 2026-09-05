import Link from "next/link";
import type { Vehicle } from "@/lib/types";
import { formatVehicleName } from "@/lib/format";
import { primaryPhotoFor } from "@/lib/data/vehicle-images";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { FoldIndex } from "@/components/fold/fold-primitives";
import { ROUTES } from "@/lib/routes";

type FoldRailProps = {
  vehicles: Vehicle[];
};

export function FoldRail({ vehicles }: FoldRailProps) {
  if (vehicles.length === 0) return null;

  return (
    <section className="bg-[var(--nabus-paper)] py-16 sm:py-22">
      <div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <FoldIndex n="04" />
            <h2 className="font-display mt-3 text-[clamp(1.8rem,4vw,2.8rem)] leading-[1.1] text-[var(--nabus-graphite)]">
              Just landed
            </h2>
          </div>
          <Link
            href={`${ROUTES.auto.inventory}?sort=newest`}
            className="hidden text-[13px] underline decoration-[var(--nabus-border)] underline-offset-4 hover:text-[var(--nabus-wine)] sm:inline"
          >
            All new arrivals
          </Link>
        </div>
      </div>

      <div className="mt-8 flex gap-0 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {vehicles.map((vehicle) => (
          <Link
            key={vehicle.id}
            href={ROUTES.auto.inventoryDetail(vehicle.slug)}
            className="group w-[min(78vw,22rem)] shrink-0 sm:w-[24rem]"
          >
            <SafeVehicleImage
              src={primaryPhotoFor(vehicle)}
              alt={formatVehicleName(vehicle)}
              className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
            <div className="px-4 pt-3 pb-6 sm:px-5">
              <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-[var(--nabus-muted)]">
                {vehicle.year}  {vehicle.transmission}
              </p>
              <h3 className="font-display mt-1 text-lg leading-snug text-[var(--nabus-graphite)] group-hover:text-[var(--nabus-wine)]">
                {formatVehicleName(vehicle)}
              </h3>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
