"use client";

import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  buildFilterSearchParams,
  parseFiltersFromSearchParams,
} from "@/lib/vehicles";
import { MAX_PUBLIC_SEARCH_LENGTH } from "@/lib/vehicles/keyword-search";
import { ROUTES } from "@/lib/routes";
import type { SortOption } from "@/lib/types";
import { InventoryMobileFilters } from "@/components/inventory/inventory-mobile-filters";
import { ActiveFilterChips } from "@/components/inventory/active-filter-chips";

const SEARCH_DEBOUNCE_MS = 350;

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
  const [draftQ, setDraftQ] = useState(filters.q ?? "");
  const skipDebounceRef = useRef(false);

  useEffect(() => {
    skipDebounceRef.current = true;
    setDraftQ(filters.q ?? "");
  }, [filters.q]);

  useEffect(() => {
    if (skipDebounceRef.current) {
      skipDebounceRef.current = false;
      return;
    }

    const nextQ = draftQ.trim().slice(0, MAX_PUBLIC_SEARCH_LENGTH);
    const currentQ = filters.q ?? "";
    if (nextQ === currentQ) return;

    const timer = window.setTimeout(() => {
      const nextFilters = { ...filters };
      if (nextQ) nextFilters.q = nextQ;
      else delete nextFilters.q;
      const query = buildFilterSearchParams(nextFilters, sort);
      startTransition(() => {
        router.push(`${ROUTES.auto.inventory}?${query.toString()}`);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [draftQ, filters, sort, router]);

  function handleSortChange(value: string) {
    const query = buildFilterSearchParams(filters, value as SortOption);
    startTransition(() => {
      router.push(`${ROUTES.auto.inventory}?${query.toString()}`);
    });
  }

  function commitSearchNow() {
    const nextQ = draftQ.trim().slice(0, MAX_PUBLIC_SEARCH_LENGTH);
    const currentQ = filters.q ?? "";
    if (nextQ === currentQ) return;

    const nextFilters = { ...filters };
    if (nextQ) nextFilters.q = nextQ;
    else delete nextFilters.q;
    const query = buildFilterSearchParams(nextFilters, sort);
    startTransition(() => {
      router.push(`${ROUTES.auto.inventory}?${query.toString()}`);
    });
  }

  return (
    <div className="mb-6 space-y-3">
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          commitSearchNow();
        }}
      >
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={draftQ}
          onChange={(e) => setDraftQ(e.target.value)}
          maxLength={MAX_PUBLIC_SEARCH_LENGTH}
          placeholder="Search make, model, year, color…"
          aria-label="Search inventory"
          className="h-11 rounded-lg border-[var(--nabus-input-border)] pl-9 focus-visible:border-[var(--nabus-primary)]"
        />
      </form>
      <Suspense fallback={null}>
        <ActiveFilterChips />
      </Suspense>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--nabus-text-secondary)]">
          <span className="font-semibold tabular-nums text-[var(--nabus-charcoal)]">{total}</span>{" "}
          vehicle{total !== 1 ? "s" : ""} found
          {isPending && " · Updating…"}
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
