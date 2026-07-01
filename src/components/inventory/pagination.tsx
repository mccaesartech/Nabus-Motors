"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildFilterSearchParams,
  parseFiltersFromSearchParams,
} from "@/lib/vehicles";
import { ROUTES } from "@/lib/routes";
import type { SortOption } from "@/lib/types";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const searchParams = useSearchParams();
  const params = Object.fromEntries(searchParams.entries());
  const filters = parseFiltersFromSearchParams(params);
  const sort = (params.sort as SortOption) || "newest";

  if (totalPages <= 1) return null;

  function pageHref(page: number) {
    const query = buildFilterSearchParams(filters, sort, page);
    return `${ROUTES.auto.inventory}?${query.toString()}`;
  }

  return (
    <div className="mt-10 flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage <= 1}
        render={<Link href={pageHref(currentPage - 1)} />}
      >
        <ChevronLeft className="size-4" />
        Previous
      </Button>
      <span className="px-4 text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage >= totalPages}
        render={<Link href={pageHref(currentPage + 1)} />}
      >
        Next
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
