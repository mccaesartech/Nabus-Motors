import { Suspense } from "react";
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { Container } from "@/components/shared/container";
import { VehicleCard } from "@/components/shared/vehicle-card";
import { CustomVehicleRequestCta } from "@/components/vehicle/custom-vehicle-request-cta";
import {
  parseFiltersFromSearchParams,
  parsePageFromSearchParams,
  parseSortFromSearchParams,
} from "@/lib/vehicles";
import { queryFilteredVehicles } from "@/lib/supabase/vehicle-queries";
import { getSiteContent } from "@/lib/site-content";
import { resolveFulfillmentMode } from "@/lib/vehicles/fulfillment";
import { hasActiveInventoryFilters } from "@/lib/vehicles/filter-config";

const InventoryFilters = dynamic(
  () =>
    import("@/components/inventory/inventory-filters").then((m) => ({
      default: m.InventoryFilters,
    })),
  { loading: () => <div className="hidden w-64 shrink-0 lg:block" aria-hidden /> }
);

const SortBar = dynamic(
  () =>
    import("@/components/inventory/sort-bar").then((m) => ({
      default: m.SortBar,
    })),
  { loading: () => null }
);

const Pagination = dynamic(
  () =>
    import("@/components/inventory/pagination").then((m) => ({
      default: m.Pagination,
    })),
  { loading: () => null }
);

const RecommendedVehiclesSection = dynamic(
  () =>
    import("@/components/recommendations/recommended-vehicles-section").then(
      (m) => ({ default: m.RecommendedVehiclesSection })
    ),
  { loading: () => null }
);

const PAGE_SIZE = 9;

export const revalidate = 120;

interface InventoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata = {
  title: "Inventory",
  description:
    "Browse and search our verified vehicle inventory by make, model, year, and more.",
};

function FiltersFallback() {
  return <div className="hidden w-64 shrink-0 lg:block" />;
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const params = await searchParams;
  const filters = parseFiltersFromSearchParams(params);
  const sort = parseSortFromSearchParams(params);
  const page = parsePageFromSearchParams(params);
  const fulfillmentMode = resolveFulfillmentMode(filters);
  const isPreorderView = fulfillmentMode === "pre_order_only";
  const isLocallyAvailableView = fulfillmentMode === "in_ghana";
  const filtersActive = hasActiveInventoryFilters(filters);

  const [{ vehicles: paginated, total }, content] = await Promise.all([
    queryFilteredVehicles(filters, sort, page, PAGE_SIZE),
    getSiteContent(),
  ]);
  const pageCopy = content.inventoryPage;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.min(Math.max(1, page), totalPages || 1);

  return (
    <div className="py-10 sm:py-14">
      <Container>
        {isLocallyAvailableView ? (
          <div className="mb-8 overflow-hidden rounded-xl border border-brand-purple/30 bg-gradient-to-r from-brand-purple/10 via-brand-gold/8 to-brand-purple/5 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-brand-gold/45 bg-brand-gold/15">
                <MapPin className="size-5 text-brand-purple" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">
                  Ghana inventory
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Available in Ghana
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  In-stock Ghana inventory and newly arrived vehicles — ready for
                  immediate delivery with no international shipping.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {isPreorderView ? pageCopy.preorderTitle : pageCopy.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isPreorderView ? pageCopy.preorderSubtitle : pageCopy.subtitle}
            </p>
          </div>
        )}

        {isPreorderView && (
          <CustomVehicleRequestCta variant="banner" className="mb-8" />
        )}

        <div className="flex min-w-0 flex-col gap-8 lg:flex-row">
          <Suspense fallback={<FiltersFallback />}>
            <InventoryFilters className="hidden w-64 shrink-0 lg:block" />
          </Suspense>

          <div className="min-w-0 flex-1">
            {!filtersActive && <RecommendedVehiclesSection variant="inventory" />}

            <Suspense fallback={null}>
              <SortBar total={total} />
            </Suspense>

            {paginated.length > 0 ? (
              <div className="grid w-full auto-rows-fr gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4">
                {paginated.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} className="h-full" />
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
