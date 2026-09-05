import Link from "next/link";
import type { Vehicle } from "@/lib/types";
import { formatVehicleName } from "@/lib/format";
import { primaryPhotoFor } from "@/lib/data/vehicle-images";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { VehicleCardPrice } from "@/components/shared/vehicle-card-client";
import { FoldIndex } from "@/components/fold/fold-primitives";
import { ROUTES } from "@/lib/routes";

type FoldPickProps = {
  vehicles: Vehicle[];
};

export function FoldPick({ vehicles }: FoldPickProps) {
  if (vehicles.length === 0) return null;

  const [hero, ...rest] = vehicles;
  const companions = rest.slice(0, 2);

  return (
    <section className="relative overflow-hidden bg-[var(--nabus-ivory)] py-16 sm:py-24">
      <div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-0">
        <div className="px-0 lg:px-8 xl:px-10">
          <FoldIndex n="03" />
          <h2 className="font-display mt-3 max-w-md text-[clamp(1.8rem,4vw,3rem)] leading-[1.1] text-[var(--nabus-graphite)]">
            One floor pick, two companions.
          </h2>
        </div>

        <div className="mt-10 grid items-stretch lg:grid-cols-[minmax(0,1.7fr)_minmax(0,0.9fr)]">
          <Link
            href={ROUTES.auto.inventoryDetail(hero.slug)}
            className="group relative block min-h-[52vw] overflow-hidden bg-[var(--nabus-graphite)] lg:min-h-[34rem]"
          >
            <SafeVehicleImage
              src={primaryPhotoFor(hero)}
              alt={formatVehicleName(hero)}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--nabus-graphite)]/85 to-transparent p-6 sm:p-8">
              <p className="font-mono text-[11px] tracking-[0.16em] uppercase text-[var(--nabus-gold)]">
                Floor pick
              </p>
              <h3 className="font-display mt-2 text-2xl text-[var(--nabus-paper)] sm:text-3xl">
                {formatVehicleName(hero)}
              </h3>
              <p className="mt-2 text-[var(--nabus-paper)]">
                <VehicleCardPrice vehicle={hero} className="text-lg tabular-nums" />
              </p>
            </div>
          </Link>

          <div className="flex flex-col bg-[var(--nabus-paper)]">
            {companions.length === 0 ? (
              <p className="p-8 text-sm text-[var(--nabus-muted)]">More cars land on the floor this week.</p>
            ) : (
              companions.map((vehicle) => (
                <Link
                  key={vehicle.id}
                  href={ROUTES.auto.inventoryDetail(vehicle.slug)}
                  className="group grid flex-1 border-t border-[var(--nabus-border)] sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:border-t-0 lg:border-b"
                >
                  <div className="relative min-h-[11rem] overflow-hidden">
                    <SafeVehicleImage
                      src={primaryPhotoFor(vehicle)}
                      alt={formatVehicleName(vehicle)}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="flex flex-col justify-center px-5 py-5">
                    <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-[var(--nabus-muted)]">
                      Companion
                    </p>
                    <h3 className="font-display mt-1 text-xl leading-snug text-[var(--nabus-graphite)] group-hover:text-[var(--nabus-wine)]">
                      {formatVehicleName(vehicle)}
                    </h3>
                    <p className="mt-2">
                      <VehicleCardPrice vehicle={vehicle} className="tabular-nums" />
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
