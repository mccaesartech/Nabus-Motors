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
import { makes, modelsByMake } from "@/lib/data/vehicles";
import { buildFilterSearchParams, parseFiltersFromSearchParams } from "@/lib/vehicles";
import type { BodyType, Condition, FuelType, SortOption, VehicleFilters } from "@/lib/types";

const currentYear = new Date().getFullYear();

interface InventoryFiltersProps {
  className?: string;
}

export function InventoryFilters({ className }: InventoryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

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
        router.push(`/inventory?${query.toString()}`);
      });
    },
    [filters, sort, router]
  );

  const clearFilters = () => {
    startTransition(() => router.push("/inventory"));
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
              value={filters.priceMax ? String(filters.priceMax) : ""}
              onValueChange={(v) =>
                updateFilters({ priceMax: v ? Number(v) : undefined })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any price" />
              </SelectTrigger>
              <SelectContent>
                {[20000, 30000, 40000, 50000, 60000, 75000, 100000].map((p) => (
                  <SelectItem key={p} value={String(p)}>
                    Up to ${p.toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Brand</Label>
            <Select
              value={filters.make ?? ""}
              onValueChange={(v) =>
                updateFilters({ make: v || undefined, model: undefined })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any brand" />
              </SelectTrigger>
              <SelectContent>
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
              value={filters.model ?? ""}
              onValueChange={(v) => updateFilters({ model: v || undefined })}
              disabled={!filters.make}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any model" />
              </SelectTrigger>
              <SelectContent>
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
              value={filters.yearMin ? String(filters.yearMin) : ""}
              onValueChange={(v) => {
                const year = v ? Number(v) : undefined;
                updateFilters({ yearMin: year, yearMax: year });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any year" />
              </SelectTrigger>
              <SelectContent>
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
              value={filters.mileageMax ? String(filters.mileageMax) : ""}
              onValueChange={(v) =>
                updateFilters({ mileageMax: v ? Number(v) : undefined })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any mileage" />
              </SelectTrigger>
              <SelectContent>
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
              value={filters.fuelType ?? ""}
              onValueChange={(v) =>
                updateFilters({ fuelType: (v as FuelType) || undefined })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any fuel type" />
              </SelectTrigger>
              <SelectContent>
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
              value={filters.bodyType ?? ""}
              onValueChange={(v) =>
                updateFilters({ bodyType: (v as BodyType) || undefined })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any body type" />
              </SelectTrigger>
              <SelectContent>
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
              value={filters.condition ?? ""}
              onValueChange={(v) =>
                updateFilters({ condition: (v as Condition) || undefined })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any condition" />
              </SelectTrigger>
              <SelectContent>
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
      </div>
    </aside>
  );
}
