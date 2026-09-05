import { CatalogueClient } from "@/components/inventory/catalogue-client";
import {
  parseFiltersFromSearchParams,
  parsePageFromSearchParams,
  parseSortFromSearchParams,
} from "@/lib/vehicles";
import { queryFilteredVehicles } from "@/lib/supabase/vehicle-queries";
import { getSiteContent } from "@/lib/site-content";
import { resolveFulfillmentMode } from "@/lib/vehicles/fulfillment";

const PAGE_SIZE = 9;

export const revalidate = 120;

interface InventoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata = {
  title: "Cars",
  description: "Browse the Nabus Motors showroom — verified inventory in Accra and import-ready vehicles.",
};

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const params = await searchParams;
  const filters = parseFiltersFromSearchParams(params);
  const sort = parseSortFromSearchParams(params);
  const page = parsePageFromSearchParams(params);
  const fulfillmentMode = resolveFulfillmentMode(filters);
  const isPreorderView = fulfillmentMode === "pre_order_only";
  const isLocallyAvailableView = fulfillmentMode === "in_ghana";

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
      ? pageCopy.preorderTitle || "Import Ready"
      : "CARS";

  const headerDescription = isLocallyAvailableView
    ? "In-stock Ghana inventory and newly arrived vehicles — ready for immediate delivery."
    : isPreorderView
      ? pageCopy.preorderSubtitle
      : pageCopy.subtitle || "Curated inventory. Transparent pricing. Reserve with confidence.";

  return (
    <CatalogueClient
      vehicles={paginated}
      total={total}
      currentPage={currentPage}
      totalPages={totalPages}
      filters={filters}
      isPreorderView={isPreorderView}
      isLocallyAvailableView={isLocallyAvailableView}
      headerTitle={headerTitle}
      headerDescription={headerDescription}
    />
  );
}
