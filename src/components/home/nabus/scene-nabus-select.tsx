import Link from "next/link";
import type { Vehicle } from "@/lib/types";
import { NabusCarTile } from "@/components/nabus/nabus-car-tile";
import { NabusSectionLabel } from "@/components/nabus/nabus-section-label";
import { ROUTES } from "@/lib/routes";

type SceneNabusSelectProps = {
  vehicles: Vehicle[];
};

export function SceneNabusSelect({ vehicles }: SceneNabusSelectProps) {
  if (vehicles.length === 0) return null;

  const [featured, ...rest] = vehicles;
  const secondary = rest.slice(0, 2);

  return (
    <section className="bg-[var(--nabus-ivory)] py-16 sm:py-20">
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10 xl:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <NabusSectionLabel>Nabus Select</NabusSectionLabel>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--nabus-graphite)]">
              Hand-picked for the showroom floor.
            </h2>
          </div>
          <Link
            href={ROUTES.auto.inventory}
            className="text-sm font-semibold uppercase tracking-wide text-[var(--nabus-wine)] hover:text-[var(--nabus-crimson)]"
          >
            View all →
          </Link>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <NabusCarTile vehicle={featured} layout="featured-large" />
          </div>
          <div className="grid gap-8 lg:col-span-5">
            {secondary.map((v) => (
              <NabusCarTile key={v.id} vehicle={v} layout="featured-small" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
