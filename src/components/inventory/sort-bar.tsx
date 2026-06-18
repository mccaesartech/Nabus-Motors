"use client";

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
import type { SortOption } from "@/lib/types";

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
      router.push(`/inventory?${query.toString()}`);
    });
  }

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {total} vehicle{total !== 1 ? "s" : ""} found
        {isPending && " · Updating..."}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Sort by</span>
        <Select value={sort} onValueChange={(v) => handleSortChange(v ?? "newest")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest Listed</SelectItem>
            <SelectItem value="price-asc">Price: Low to High</SelectItem>
            <SelectItem value="price-desc">Price: High to Low</SelectItem>
            <SelectItem value="year-desc">Year: Newest</SelectItem>
            <SelectItem value="year-asc">Year: Oldest</SelectItem>
            <SelectItem value="mileage-asc">Mileage: Low to High</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
