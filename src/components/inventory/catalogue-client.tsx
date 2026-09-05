"use client";

import { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Car } from "lucide-react";
import { NabusCarTile } from "@/components/nabus/nabus-car-tile";
import { NabusEmptyState } from "@/components/nabus/nabus-empty-state";
import { NabusFilterSheet, NabusFilterTrigger } from "@/components/nabus/nabus-filter-sheet";
import { NabusSectionLabel } from "@/components/nabus/nabus-section-label";
import { NabusOwnershipPack } from "@/components/nabus/nabus-ownership-pack";
import { CustomVehicleRequestCta } from "@/components/vehicle/custom-vehicle-request-cta";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import type { Vehicle } from "@/lib/types";
import { hasActiveInventoryFilters } from "@/lib/vehicles/filter-config";
import type { VehicleFilters } from "@/lib/types";

const SortBar = dynamic(
  () => import("@/components/inventory/sort-bar").then((m) => ({ default: m.SortBar })),
  { loading: () => null }
);

const Pagination = dynamic(
  () => import("@/components/inventory/pagination").then((m) => ({ default: m.Pagination })),
  { loading: () => null }
);

type CatalogueClientProps = {
  vehicles: Vehicle[];
  total: number;
  currentPage: number;
  totalPages: number;
  filters: VehicleFilters;
  isPreorderView: boolean;
  isLocallyAvailableView: boolean;
  headerTitle: string;
  headerDescription?: string;
};

export function CatalogueClient({
  vehicles,
  total,
  currentPage,
  totalPages,
  filters,
  isPreorderView,
  isLocallyAvailableView,
  headerTitle,
  headerDescription,
}: CatalogueClientProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const filtersActive = hasActiveInventoryFilters(filters);

  return (
    <div className="bg-[var(--nabus-ivory)] py-10 sm:py-14">
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10 xl:px-12">
        <NabusSectionLabel>{isLocallyAvailableView ? "In Ghana" : "The Showroom"}</NabusSectionLabel>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--nabus-graphite)] sm:text-4xl">
          {headerTitle || "Cars"}
        </h1>
        {headerDescription ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--nabus-muted)]">
            {headerDescription}
          </p>
        ) : null}

        {isPreorderView ? <CustomVehicleRequestCta variant="banner" className="mt-8" /> : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-y border-[var(--nabus-border)] py-4">
          <div className="flex items-center gap-3">
            <NabusFilterTrigger onClick={() => setFilterOpen(true)} />
            <span className="font-mono text-xs text-[var(--nabus-muted)]">
              {total} vehicle{total === 1 ? "" : "s"}
            </span>
          </div>
          <Suspense fallback={null}>
            <SortBar total={total} />
          </Suspense>
        </div>

        <NabusFilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} side="bottom" />

        {vehicles.length > 0 ? (
          <div className="mt-8 grid auto-rows-fr gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((vehicle, index) => (
              <div key={vehicle.id} className="contents">
                <NabusCarTile vehicle={vehicle} className="h-full" />
                {(index + 1) % 9 === 0 && index < vehicles.length - 1 ? (
                  <div className="col-span-full border border-[var(--nabus-border)] bg-[var(--nabus-paper)] p-8 sm:p-10">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--nabus-gold)]">
                      Nabus Select
                    </p>
                    <p className="mt-2 max-w-md text-lg font-semibold text-[var(--nabus-graphite)]">
                      Every vehicle verified. Reserve online, inspect in person.
                    </p>
                    <Link
                      href={ROUTES.corporate.contact}
                      className="mt-4 inline-block text-sm font-semibold uppercase tracking-wide text-[var(--nabus-wine)]"
                    >
                      Visit showroom →
                    </Link>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <NabusEmptyState
            icon={Car}
            title="No vehicles match your search"
            description="Adjust filters or browse the full showroom floor."
            className="mt-8"
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  variant="outline"
                  className="rounded-none border-[var(--nabus-border)]"
                  render={<Link href={ROUTES.auto.inventory} />}
                >
                  Clear Filters
                </Button>
                <CustomVehicleRequestCta className="max-w-sm" />
              </div>
            }
          />
        )}

        {!filtersActive && vehicles.length > 0 ? (
          <div className="mt-16">
            <NabusOwnershipPack tone="light" />
          </div>
        ) : null}

        <Suspense fallback={null}>
          <Pagination currentPage={currentPage} totalPages={totalPages} />
        </Suspense>
      </div>
    </div>
  );
}
