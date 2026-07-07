"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import {
  CompareEmptyState,
  VehicleCompareTable,
} from "@/components/compare/vehicle-compare-table";
import { useCompare } from "@/hooks/use-compare";
import { buildVehicleLookupMap, useGarageVehicles } from "@/hooks/use-garage";
import { ROUTES } from "@/lib/routes";
import type { Vehicle } from "@/lib/types";

export function ComparePageClient() {
  const { compareIds, loaded, clearCompare } = useCompare();
  const { vehicles: fetched, loaded: vehiclesLoaded } = useGarageVehicles(
    compareIds,
    compareIds
  );

  const vehicleById = useMemo(
    () => buildVehicleLookupMap(fetched),
    [fetched]
  );

  const vehicles = compareIds
    .map((id) => vehicleById.get(id))
    .filter((v): v is Vehicle => Boolean(v));

  if (!loaded || (compareIds.length > 0 && !vehiclesLoaded)) {
    return (
      <Container className="py-20">
        <p className="text-sm text-muted-foreground">Loading compare list…</p>
      </Container>
    );
  }

  return (
    <div className="py-10 sm:py-14">
      <Container>
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="size-6 text-brand-purple" />
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Compare Vehicles
              </h1>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Side-by-side specifications for up to 4 vehicles.
            </p>
          </div>
          {compareIds.length > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={clearCompare}>
                Clear all
              </Button>
              <Button render={<Link href={ROUTES.auto.inventory} />}>
                Add more
              </Button>
            </div>
          )}
        </div>

        {vehicles.length === 0 ? (
          <CompareEmptyState />
        ) : vehicles.length === 1 ? (
          <div className="space-y-6">
            <div className="border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Add at least one more vehicle to compare side by side.
            </div>
            <VehicleCompareTable vehicles={vehicles} />
          </div>
        ) : (
          <VehicleCompareTable vehicles={vehicles} />
        )}

        {compareIds.length > vehicles.length && (
          <p className="mt-6 text-sm text-muted-foreground">
            {compareIds.length - vehicles.length} selected vehicle
            {compareIds.length - vehicles.length === 1 ? " is" : "s are"} no longer
            available and were skipped.
          </p>
        )}
      </Container>
    </div>
  );
}
