import Link from "next/link";
import type { Vehicle } from "@/lib/types";
import { formatVehicleName } from "@/lib/format";
import { primaryPhotoFor } from "@/lib/data/vehicle-images";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { VehiclePrice } from "@/components/shared/vehicle-price";
import { NabusSectionLabel } from "@/components/nabus/nabus-section-label";
import { ROUTES } from "@/lib/routes";

type SceneLatestDealProps = {
  vehicle?: Vehicle;
};

export function SceneLatestDeal({ vehicle }: SceneLatestDealProps) {
  if (!vehicle) return null;

  return (
    <section className="border-y border-[var(--nabus-border)] bg-[var(--nabus-paper)] py-16 sm:py-20">
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10 xl:px-12">
        <NabusSectionLabel>Latest Deal</NabusSectionLabel>
        <div className="mt-8 grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
          <Link
            href={ROUTES.auto.inventoryDetail(vehicle.slug)}
            className="group relative block overflow-hidden"
          >
            <SafeVehicleImage
              src={primaryPhotoFor(vehicle)}
              alt={formatVehicleName(vehicle)}
              className="aspect-[16/10] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </Link>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--nabus-gold)]">
              Featured Campaign
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--nabus-graphite)]">
              {formatVehicleName(vehicle)}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[var(--nabus-muted)] line-clamp-3">
              {vehicle.description}
            </p>
            <p className="mt-6 text-2xl font-semibold tabular-nums text-[var(--nabus-graphite)]">
              <VehiclePrice vehicle={vehicle} />
            </p>
            <Link
              href={ROUTES.auto.inventoryDetail(vehicle.slug)}
              className="mt-8 inline-flex h-11 items-center bg-[var(--nabus-wine)] px-6 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-[var(--nabus-crimson)]"
            >
              Reserve This Car
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
