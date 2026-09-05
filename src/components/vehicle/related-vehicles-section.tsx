"use client";

import { useEffect, useState } from "react";
import { FoldCarTile } from "@/components/fold/fold-car-tile";
import { FoldIndex } from "@/components/fold/fold-primitives";
import type { Vehicle } from "@/lib/types";

type RelatedVehiclesSectionProps = {
  vehicle: Vehicle;
  limit?: number;
  title?: string;
};

export function RelatedVehiclesSection({
  vehicle,
  limit = 3,
  title = "Similar",
}: RelatedVehiclesSectionProps) {
  const [related, setRelated] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/vehicles/related", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vehicleId: vehicle.id, limit }),
        });
        if (!res.ok) throw new Error("related failed");
        const data = (await res.json()) as { vehicles: Vehicle[] };
        if (!cancelled) setRelated((data.vehicles ?? []).slice(0, limit));
      } catch {
        if (!cancelled) setRelated([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [vehicle.id, limit]);

  if (loading || related.length === 0) return null;

  const [first, ...rest] = related;

  return (
    <section className="mt-16 border-t border-[var(--nabus-border)] bg-[var(--nabus-paper)] py-14">
      <div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8 xl:px-10">
        <FoldIndex n="LIKE" />
        <h2 className="font-display mt-3 text-3xl leading-tight text-[var(--nabus-graphite)]">{title}</h2>
        <div className="mt-8 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <FoldCarTile vehicle={first} layout="featured-large" />
          </div>
          <div className="grid gap-10 lg:col-span-6 sm:grid-cols-2">
            {rest.map((item) => (
              <FoldCarTile key={item.id} vehicle={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
