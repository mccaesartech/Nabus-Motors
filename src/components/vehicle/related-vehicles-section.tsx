"use client";

import { useEffect, useState } from "react";
import { NabusCarTile } from "@/components/nabus/nabus-car-tile";
import { NabusSectionLabel } from "@/components/nabus/nabus-section-label";
import type { Vehicle } from "@/lib/types";

type RelatedVehiclesSectionProps = {
  vehicle: Vehicle;
  limit?: number;
  title?: string;
};

export function RelatedVehiclesSection({
  vehicle,
  limit = 3,
  title = "Similar Drives",
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

  return (
    <section className="mt-16 border-t border-[var(--nabus-border)] bg-[var(--nabus-paper)] py-12">
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10 xl:px-12">
        <NabusSectionLabel>{title}</NabusSectionLabel>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--nabus-graphite)]">
          You might also consider
        </h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((item) => (
            <NabusCarTile key={item.id} vehicle={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
