"use client";

import { useEffect, useState } from "react";
import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { VehicleCard } from "@/components/shared/vehicle-card";
import type { Vehicle } from "@/lib/types";
import { getRelatedVehicles } from "@/lib/vehicle-recommendations";

type RelatedVehiclesSectionProps = {
  vehicle: Vehicle;
};

export function RelatedVehiclesSection({ vehicle }: RelatedVehiclesSectionProps) {
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
          body: JSON.stringify({ vehicleId: vehicle.id, limit: 4 }),
        });
        if (!res.ok) throw new Error("related failed");
        const data = (await res.json()) as { vehicles: Vehicle[] };
        if (!cancelled) setRelated(data.vehicles ?? []);
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
  }, [vehicle.id]);

  if (loading || related.length === 0) return null;

  return (
    <section className="mt-16 border-t border-border pt-12">
      <Container>
        <SectionHeader
          title="Related Vehicles"
          description="Similar listings you may want to compare."
          className="mb-8"
        />
        <div className="grid w-full gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((item) => (
            <VehicleCard key={item.id} vehicle={item} />
          ))}
        </div>
      </Container>
    </section>
  );
}
