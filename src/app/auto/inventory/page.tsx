import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Container } from "@/components/shared/container";
import { NabusVehicleCard } from "@/components/nabus/nabus-vehicle-card";
import { NabusPageHeader } from "@/components/nabus/nabus-page-header";
import { NabusEmptyState } from "@/components/nabus/nabus-empty-state";
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
import Link from "next/link";
import { Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

const InventoryFilters = dynamic(
  () =>
    import("@/components/inventory/inventory-filters").then((m) => ({
      default: m.InventoryFilters,
    })),
  { loading: () => <div className="hidden w-72 shrink-0 lg:block" aria-hidden /> }
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
  title: "Shop Cars",
  description:
    "Browse and search verified Nabus Motors inventory by make, model, year, and more.",
};

function FiltersFallback() {
  return <div className="hidden w-72 shrink-0 lg:block" />;
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

  const headerTitle = isLocallyAvailableView
    ? "Available in Ghana"
    : isPreorderView
      ? pageCopy.preorderTitle
      : pageCopy.title || "Find Your Next Car";

  const headerDescription = isLocallyAvailableView
    ? "In-stock Ghana inventory and newly arrived vehicles — ready for immediate delivery."
    : isPreorderView
      ? pageCopy.preorderSubtitle
      : pageCopy.subtitle;

  return (
    <div className="py-10 sm:py-14">
      <Container>
        <NabusPageHeader
          eyebrow={isLocallyAvailableView ? "Ghana Inventory" : isPreorderView ? "Import" : "Shop Cars"}
          title={headerTitle}
          description={headerDescription}
          variant={isLocallyAvailableView ? "accent" : "default"}
        />

        {isPreorderView && (
          <CustomVehicleRequestCta variant="banner" className="mb-8" />
        )}

        <div className="flex min-w-0 flex-col gap-8 lg:flex-row">
          <Suspense fallback={<FiltersFallback />}>
            <InventoryFilters className="hidden w-72 shrink-0 lg:block" />
          </Suspense>

          <div className="min-w-0 flex-1">
            {!filtersActive && <RecommendedVehiclesSection variant="inventory" />}

            <Suspense fallback={null}>
              <SortBar total={total} />
            </Suspense>

            {paginated.length > 0 ? (
              <div className="mt-6 grid w-full auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {paginated.map((vehicle) => (
                  <NabusVehicleCard key={vehicle.id} vehicle={vehicle} className="h-full" />
                ))}
              </div>
            ) : (
              <NabusEmptyState
                icon={Car}
                title="No vehicles match your filters"
                description="Try adjusting your search criteria or browse our full inventory."
                className="mt-6"
                action={
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button
                      variant="outline"
                      className="rounded-full"
                      render={<Link href={ROUTES.auto.inventory} />}
                    >
                      Clear Filters
                    </Button>
                    <CustomVehicleRequestCta className="max-w-sm" />
                  </div>
                }
              />
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
