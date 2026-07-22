import {
  EMPTY_INVENTORY_FILTERS,
  type InventoryFilters,
  type VehicleLike,
  isChineseMake,
  vehicleCategories,
} from "@/lib/admin/vehicle-filters";
import { cn } from "@/lib/utils";

const ADMIN_TAG_CLASS: Record<string, string> = {
  Chinese: "bg-muted text-foreground",
  Featured: "bg-foreground/10 text-foreground",
  Electric: "bg-emerald-500/15 text-emerald-300",
  Manual: "bg-amber-500/15 text-amber-200",
  Hybrid: "bg-sky-500/15 text-sky-200",
  "Plug-in Hybrid": "bg-sky-500/15 text-sky-200",
};

const PLATFORM_TAG_CLASS: Record<string, string> = {
  SUV: "platform-cat-suv",
  Sedan: "platform-cat-sedan",
  Luxury: "platform-cat-luxury",
  Truck: "platform-cat-truck",
  Hatchback: "platform-cat-hatchback",
  Electric: "platform-cat-electric",
  Commercial: "platform-cat-commercial",
  Coupe: "platform-cat-sedan",
  Chinese: "platform-cat-chinese",
  Featured: "platform-cat-featured",
  Manual: "platform-cat-manual",
  Hybrid: "platform-cat-hybrid",
  "Plug-in Hybrid": "platform-cat-hybrid",
};

function tagClass(tag: string, variant: "admin" | "platform"): string {
  if (variant === "platform") {
    return PLATFORM_TAG_CLASS[tag] ?? "platform-cat-default";
  }
  return ADMIN_TAG_CLASS[tag] ?? "bg-white/10 text-white/70";
}

export function CategoryBadges({
  vehicle,
  variant = "platform",
  compact = false,
}: {
  vehicle: VehicleLike;
  variant?: "admin" | "platform";
  compact?: boolean;
}) {
  const tags = vehicleCategories(vehicle);

  return (
    <div
      className={cn(
        "flex flex-nowrap items-center gap-1",
        compact ? "max-w-[11rem]" : "max-w-[13rem]"
      )}
    >
      {tags.map((tag, i) => (
        <span
          key={tag}
          title={tag}
          className={cn(
            "inline-flex shrink-0 items-center truncate rounded-md font-medium uppercase tracking-wide",
            variant === "platform" ? "platform-category-badge" : "px-2.5 py-1 text-[11px] lg:px-3 lg:py-1.5 lg:text-xs",
            variant === "platform"
              ? compact
                ? "max-w-[4.5rem] px-1.5 py-0.5 text-[10px]"
                : "max-w-[5.5rem] px-2 py-0.5 text-[10px] sm:max-w-none sm:px-2.5 sm:py-1 sm:text-[11px]"
              : "",
            tagClass(tag, variant),
            i === 0 && variant === "platform" && "platform-category-badge--primary"
          )}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

export function ActiveFiltersSummary({
  filters,
  onClear,
  variant = "platform",
}: {
  filters: InventoryFilters;
  onClear: () => void;
  variant?: "admin" | "platform";
}) {
  const active: string[] = [];
  if (filters.bodyType !== "all") active.push(filters.bodyType);
  if (filters.transmission !== "all") active.push(filters.transmission);
  if (filters.fuelType !== "all") active.push(filters.fuelType);
  if (filters.brandOrigin === "chinese") active.push("Chinese brands");
  if (filters.brandOrigin === "international") active.push("International");
  if (filters.status !== "all") active.push(filters.status.replace("_", " "));
  if (filters.featured === "yes") active.push("Featured");
  if (filters.featured === "no") active.push("Not featured");
  if (filters.fulfillmentMode !== "all") {
    active.push(
      filters.fulfillmentMode === "in_ghana"
        ? "In Ghana now"
        : filters.fulfillmentMode === "import_ship"
          ? "Import / ship"
          : "Pre-order only"
    );
  }
  if (filters.availableLocally === "yes") active.push("Locally available");
  if (filters.availableLocally === "no") active.push("Not local");
  if (filters.financingAvailable === "yes") active.push("Financing");

  if (active.length === 0) return null;

  const chipClass =
    variant === "platform"
      ? "rounded-md border border-[var(--platform-border)] bg-[var(--platform-bg-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--platform-text)]"
      : "rounded-md bg-muted px-2.5 py-1 text-sm text-foreground lg:px-3";

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--platform-text-secondary)]">
        Active:
      </span>
      {active.map((label) => (
        <span key={label} className={chipClass}>
          {label}
        </span>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="text-xs font-medium text-[var(--platform-accent)] hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}

export function mergeFilters(
  base: InventoryFilters,
  partial: Partial<InventoryFilters>
): InventoryFilters {
  return { ...EMPTY_INVENTORY_FILTERS, ...base, ...partial };
}

export { isChineseMake, vehicleCategories, EMPTY_INVENTORY_FILTERS };
