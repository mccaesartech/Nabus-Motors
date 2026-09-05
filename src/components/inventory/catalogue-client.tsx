"use client";

import { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FoldCarTile } from "@/components/fold/fold-car-tile";
import { FoldOwnership } from "@/components/fold/home/fold-ownership";
import { FoldIndex } from "@/components/fold/fold-primitives";
import { NabusEmptyState } from "@/components/nabus/nabus-empty-state";
import { NabusFilterSheet, NabusFilterTrigger } from "@/components/nabus/nabus-filter-sheet";
import { CustomVehicleRequestCta } from "@/components/vehicle/custom-vehicle-request-cta";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import type { Vehicle } from "@/lib/types";
import { hasActiveInventoryFilters } from "@/lib/vehicles/filter-config";
import type { VehicleFilters } from "@/lib/types";
import { cn } from "@/lib/utils";

const SortBar = dynamic(
  () => import("@/components/inventory/sort-bar").then((m) => ({ default: m.SortBar })),
  { loading: () => null }
);

const Pagination = dynamic(
  () => import("@/components/inventory/pagination").then((m) => ({ default: m.Pagination })),
  { loading: () => null }
);

const CATALOGUE_CHIPS = [
  { label: "All", href: ROUTES.auto.inventory },
  { label: "In Ghana", href: `${ROUTES.auto.inventory}?fulfillment=in_ghana` },
  { label: "Import", href: `${ROUTES.auto.inventory}?fulfillment=pre_order_only` },
  { label: "Newest", href: `${ROUTES.auto.inventory}?sort=newest` },
  { label: "Under $25k", href: `${ROUTES.auto.inventory}?priceMax=25000` },
  { label: "SUV", href: `${ROUTES.auto.inventory}?bodyType=SUV` },
] as const;

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
  const router = useRouter();
  const filtersActive = hasActiveInventoryFilters(filters);

  const displayTitle =
    headerTitle === "The Showroom" || headerTitle === "Cars" || headerTitle === "Vehicle Inventory"
      ? "CARS"
      : headerTitle;

  return (
    <div className="bg-[var(--nabus-ivory)] py-10 sm:py-16">
      <div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8 xl:px-10">
        <FoldIndex n="SHOW" />
        <h1 className="font-display mt-3 text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.02] tracking-[-0.03em] text-[var(--nabus-graphite)]">
          {displayTitle}
        </h1>
        {headerDescription ? (
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--nabus-muted)]">
            {headerDescription}
          </p>
        ) : null}

        {isPreorderView ? <CustomVehicleRequestCta variant="banner" className="mt-8" /> : null}

        <div className="mt-8 flex flex-wrap items-center gap-2">
          {CATALOGUE_CHIPS.map((chip) => {
            const active =
              (chip.label === "In Ghana" && isLocallyAvailableView) ||
              (chip.label === "Import" && isPreorderView) ||
              (chip.label === "All" && !isLocallyAvailableView && !isPreorderView && !filtersActive);
            return (
              <button
                key={chip.label}
                type="button"
                onClick={() => router.push(chip.href)}
                className={cn(
                  "h-9 px-3 text-[12px] tracking-wide transition-colors",
                  active
                    ? "bg-[var(--nabus-wine)] text-[var(--nabus-paper)]"
                    : "text-[var(--nabus-graphite)] ring-1 ring-[var(--nabus-border)] hover:ring-[var(--nabus-wine)]"
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-[var(--nabus-border)] py-3">
          <div className="flex items-center gap-3">
            <NabusFilterTrigger onClick={() => setFilterOpen(true)} />
            <span className="font-mono text-xs text-[var(--nabus-muted)]">
              {total} {total === 1 ? "car" : "cars"}
            </span>
          </div>
          <Suspense fallback={null}>
            <SortBar total={total} />
          </Suspense>
        </div>

        <NabusFilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} side="bottom" />

        {vehicles.length > 0 ? (
          <div className="mt-10 grid auto-rows-fr gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((vehicle, index) => (
              <div key={vehicle.id} className="contents">
                <FoldCarTile vehicle={vehicle} className="h-full" />
                {(index + 1) % 9 === 0 && index < vehicles.length - 1 ? (
                  <div className="col-span-full relative overflow-hidden py-10">
                    <span className="fold-rule-gold" />
                    <p className="font-mono mt-4 text-[11px] tracking-[0.18em] uppercase text-[var(--nabus-muted)]">
                      NB / NOTE
                    </p>
                    <p className="font-display mt-2 max-w-md text-2xl leading-snug text-[var(--nabus-graphite)]">
                      Every car on this sheet can be reserved online and inspected in Dzorwulu.
                    </p>
                    <Link
                      href={ROUTES.corporate.contact}
                      className="mt-4 inline-block text-sm text-[var(--nabus-wine)] underline underline-offset-4"
                    >
                      Visit the floor
                    </Link>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <NabusEmptyState
            title="Nothing on this sheet yet"
            description="Clear the filters, or tell us what you want brought in."
            className="mt-8"
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  variant="outline"
                  className="rounded-none border-[var(--nabus-border)]"
                  render={<Link href={ROUTES.auto.inventory} />}
                >
                  Clear filters
                </Button>
                <CustomVehicleRequestCta className="max-w-sm" />
              </div>
            }
          />
        )}

        {!filtersActive && vehicles.length > 0 ? (
          <div className="mt-16">
            <FoldOwnership compact />
          </div>
        ) : null}

        <Suspense fallback={null}>
          <Pagination currentPage={currentPage} totalPages={totalPages} />
        </Suspense>
      </div>
    </div>
  );
}
