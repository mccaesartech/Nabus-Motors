"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildFilterSearchParams,
  parseFiltersFromSearchParams,
} from "@/lib/vehicles";
import { ROUTES } from "@/lib/routes";
import type { SortOption } from "@/lib/types";
import { InventoryMobileFilters } from "@/components/inventory/inventory-mobile-filters";
import { ActiveFilterChips } from "@/components/inventory/active-filter-chips";

interface SortBarProps {
  total: number;
}

export function SortBar({ total }: SortBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const params = Object.fromEntries(searchParams.entries());
  const filters = parseFiltersFromSearchParams(params);
  const sort = (params.sort as SortOption) || "newest";

  function handleSortChange(value: string) {
    const query = buildFilterSearchParams(filters, value as SortOption);
    startTransition(() => {
      router.push(`${ROUTES.auto.inventory}?${query.toString()}`);
    });
  }

  return (
    <div className="mb-6 space-y-3">
      <Suspense fallback={null}>
        <ActiveFilterChips />
      </Suspense>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {total} vehicle{total !== 1 ? "s" : ""} found
        {isPending && " · Updating..."}
      </p>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <InventoryMobileFilters />
        <span id="inventory-sort-label" className="text-xs text-muted-foreground">
          Sort by
        </span>
        <Select value={sort} onValueChange={(v) => handleSortChange(v ?? "newest")}>
          <SelectTrigger
            className="w-full min-w-0 sm:w-[180px]"
            aria-labelledby="inventory-sort-label"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest Listed</SelectItem>
            <SelectItem value="most-popular">Most Popular</SelectItem>
            <SelectItem value="price-asc">Price: Low to High</SelectItem>
            <SelectItem value="price-desc">Price: High to Low</SelectItem>
            <SelectItem value="year-desc">Year: Newest</SelectItem>
            <SelectItem value="year-asc">Year: Oldest</SelectItem>
            <SelectItem value="mileage-asc">Mileage: Low to High</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
    </div>
  );
}
