"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { makes, modelsByMake } from "@/lib/data/catalog-meta";
import { buildFilterSearchParams, parseFiltersFromSearchParams } from "@/lib/vehicles";
import { PRICE_FILTER_TIERS, formatFilterPriceLabel } from "@/lib/currency";
import { useCurrency } from "@/context/currency-context";
import { ROUTES } from "@/lib/routes";
import { CustomVehicleRequestCta } from "@/components/vehicle/custom-vehicle-request-cta";
import type { BodyType, Condition, FuelType, SortOption, VehicleFilters } from "@/lib/types";

const currentYear = new Date().getFullYear();
const FILTER_ANY = "any";

function filterSelectValue(value: string | number | undefined): string {
  return value !== undefined && value !== "" ? String(value) : FILTER_ANY;
}

interface InventoryFiltersProps {
  className?: string;
  onApplied?: () => void;
}

export function InventoryFilters({ className, onApplied }: InventoryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { currency } = useCurrency();

  const params = Object.fromEntries(searchParams.entries());
  const filters = parseFiltersFromSearchParams(params);
  const sort = (params.sort as SortOption) || "newest";

  const updateFilters = useCallback(
    (updates: Partial<VehicleFilters>) => {
      const newFilters = { ...filters, ...updates };
      Object.keys(newFilters).forEach((key) => {
        const k = key as keyof VehicleFilters;
        if (newFilters[k] === undefined || newFilters[k] === "") {
          delete newFilters[k];
        }
      });
      const query = buildFilterSearchParams(newFilters, sort);
      startTransition(() => {
        router.push(`${ROUTES.auto.inventory}?${query.toString()}`);
        onApplied?.();
      });
    },
    [filters, sort, onApplied, router]
  );

  const clearFilters = () => {
    const query = filters.status
      ? buildFilterSearchParams({ status: filters.status }).toString()
      : "";
    startTransition(() => {
      router.push(
        query ? `${ROUTES.auto.inventory}?${query}` : ROUTES.auto.inventory
      );
      onApplied?.();
    });
  };

  const availableModels = filters.make ? modelsByMake[filters.make] ?? [] : [];

  return (
    <aside className={className}>
      <div className="sticky top-24 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Filters</h2>
          <Button variant="ghost" size="xs" onClick={clearFilters}>
            Clear all
          </Button>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Max Price</Label>
            <Select
              value={filterSelectValue(filters.priceMax)}
              onValueChange={(v) =>
                updateFilters({
                  priceMax: !v || v === FILTER_ANY ? undefined : Number(v),
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ANY}>Any price</SelectItem>
                {PRICE_FILTER_TIERS.map((p) => (
                  <SelectItem key={p} value={String(p)}>
                    {formatFilterPriceLabel(p, currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Brand</Label>
            <Select
              value={filterSelectValue(filters.make)}
              onValueChange={(v) =>
                updateFilters({
                  make: !v || v === FILTER_ANY ? undefined : v,
                  model: undefined,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ANY}>Any brand</SelectItem>
                {makes.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Model</Label>
            <Select
              value={filterSelectValue(filters.model)}
              onValueChange={(v) =>
                updateFilters({
                  model: !v || v === FILTER_ANY ? undefined : v,
                })
              }
              disabled={!filters.make}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ANY}>Any model</SelectItem>
                {availableModels.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Year</Label>
            <Select
              value={filterSelectValue(filters.yearMin)}
              onValueChange={(v) => {
                const year = !v || v === FILTER_ANY ? undefined : Number(v);
                updateFilters({ yearMin: year, yearMax: year });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ANY}>Any year</SelectItem>
                {Array.from({ length: 15 }, (_, i) => currentYear - i).map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Max Mileage</Label>
            <Select
              value={filterSelectValue(filters.mileageMax)}
              onValueChange={(v) =>
                updateFilters({
                  mileageMax: !v || v === FILTER_ANY ? undefined : Number(v),
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ANY}>Any mileage</SelectItem>
                {[15000, 30000, 50000, 75000, 100000].map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    Under {m.toLocaleString()} mi
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Fuel Type</Label>
            <Select
              value={filterSelectValue(filters.fuelType)}
              onValueChange={(v) =>
                updateFilters({
                  fuelType:
                    !v || v === FILTER_ANY ? undefined : (v as FuelType),
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ANY}>Any fuel type</SelectItem>
                {["Petrol", "Diesel", "Hybrid", "Electric", "Plug-in Hybrid"].map(
                  (f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Body Type</Label>
            <Select
              value={filterSelectValue(filters.bodyType)}
              onValueChange={(v) =>
                updateFilters({
                  bodyType: !v || v === FILTER_ANY ? undefined : (v as BodyType),
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ANY}>Any body type</SelectItem>
                {["SUV", "Sedan", "Luxury", "Truck", "Commercial", "Electric"].map(
                  (b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Condition</Label>
            <Select
              value={filterSelectValue(filters.condition)}
              onValueChange={(v) =>
                updateFilters({
                  condition: !v || v === FILTER_ANY ? undefined : (v as Condition),
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ANY}>Any condition</SelectItem>
                {["New", "Used", "Certified Pre-Owned"].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isPending && (
          <p className="text-xs text-muted-foreground">Updating results...</p>
        )}

        <CustomVehicleRequestCta className="mt-2" />
      </div>
    </aside>
  );
}
