import { Suspense } from "react";
import { Container } from "@/components/shared/container";
import { VehicleCard } from "@/components/shared/vehicle-card";
import { InventoryFilters } from "@/components/inventory/inventory-filters";
import { SortBar } from "@/components/inventory/sort-bar";
import { Pagination } from "@/components/inventory/pagination";
import { CustomVehicleRequestCta } from "@/components/vehicle/custom-vehicle-request-cta";
import {
  filterVehicles,
  parseFiltersFromSearchParams,
  sortVehicles,
} from "@/lib/vehicles";
import { fetchAllVehicles } from "@/lib/supabase/vehicles";
import { getSiteContent } from "@/lib/site-content";
import type { SortOption } from "@/lib/types";

const PAGE_SIZE = 9;

export const revalidate = 60;

interface InventoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata = {
  title: "Inventory",
  description:
    "Browse our verified vehicle inventory. Filter by price, make, model, year, and more.",
};

function FiltersFallback() {
  return <div className="hidden w-64 shrink-0 lg:block" />;
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const params = await searchParams;
  const filters = parseFiltersFromSearchParams(params);
  const sort = ((typeof params.sort === "string" ? params.sort : "newest") ||
    "newest") as SortOption;
  const page = Number(typeof params.page === "string" ? params.page : 1) || 1;
  const isPreorderView = filters.status === "pre_order";

  const [vehicles, content] = await Promise.all([fetchAllVehicles(), getSiteContent()]);
  const pageCopy = content.inventoryPage;
  const filtered = sortVehicles(filterVehicles(vehicles, filters), sort);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const currentPage = Math.min(Math.max(1, page), totalPages || 1);
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className="py-10 sm:py-14">
      <Container>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {isPreorderView ? pageCopy.preorderTitle : pageCopy.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isPreorderView ? pageCopy.preorderSubtitle : pageCopy.subtitle}
          </p>
        </div>

        {isPreorderView && (
          <CustomVehicleRequestCta variant="banner" className="mb-8" />
        )}

        <div className="flex min-w-0 flex-col gap-8 lg:flex-row">
          <Suspense fallback={<FiltersFallback />}>
            <InventoryFilters className="hidden w-64 shrink-0 lg:block" />
          </Suspense>

          <div className="min-w-0 flex-1">
            <Suspense fallback={null}>
              <SortBar total={filtered.length} />
            </Suspense>

            {paginated.length > 0 ? (
              <div className="grid w-full gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4">
                {paginated.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} />
                ))}
              </div>
            ) : (
              <div className="space-y-6 border border-dashed border-border py-16 text-center">
                <p className="text-sm font-medium">No vehicles match your filters</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try adjusting your search criteria.
                </p>
                <CustomVehicleRequestCta className="mx-auto max-w-sm" />
              </div>
            )}

            <Suspense fallback={null}>
              <Pagination currentPage={currentPage} totalPages={totalPages} />
            </Suspense>
          </div>
        </div>
      </Container>
    </div>
  );
}
