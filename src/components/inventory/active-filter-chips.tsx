"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRICE_FILTER_TIERS, formatFilterPriceLabel } from "@/lib/currency";
import { useCurrency } from "@/context/currency-context";
import { ROUTES } from "@/lib/routes";
import {
  BODY_TYPE_OPTIONS,
  FULFILLMENT_MODES,
  MILEAGE_FILTER_TIERS,
  MILEAGE_UNIT,
  TRUST_BADGE_FILTER_OPTIONS,
} from "@/lib/vehicles/filter-config";
import { resolveFulfillmentMode } from "@/lib/vehicles/fulfillment";
import {
  buildFilterSearchParams,
  parseFiltersFromSearchParams,
} from "@/lib/vehicles";
import type { SortOption, VehicleFilters } from "@/lib/types";
import { TRUST_BADGE_LABELS } from "@/lib/vehicles/trust-badges";

type ChipDef = {
  key: string;
  label: string;
  clear: Partial<VehicleFilters>;
};

function buildChips(filters: VehicleFilters, currency: string): ChipDef[] {
  const chips: ChipDef[] = [];
  const fulfillment = resolveFulfillmentMode(filters);

  if (filters.q) {
    chips.push({
      key: "q",
      label: `Search: ${filters.q}`,
      clear: { q: undefined },
    });
  }

  if (fulfillment !== "all") {
    const modeLabel =
      FULFILLMENT_MODES.find((m) => m.value === fulfillment)?.label ?? fulfillment;
    chips.push({
      key: "fulfillment",
      label: modeLabel,
      clear: {
        fulfillmentMode: undefined,
        availableLocally: undefined,
        shipmentAvailable: undefined,
        status: undefined,
      },
    });
  } else if (filters.status) {
    chips.push({
      key: "status",
      label: filters.status === "available" ? "Buy now" : filters.status.replace("_", " "),
      clear: { status: undefined },
    });
  }

  if (filters.make) {
    chips.push({ key: "make", label: filters.make, clear: { make: undefined, model: undefined } });
  }
  if (filters.model) {
    chips.push({ key: "model", label: filters.model, clear: { model: undefined } });
  }
  if (filters.yearMin) {
    chips.push({
      key: "year",
      label: `Year ${filters.yearMin}`,
      clear: { yearMin: undefined, yearMax: undefined },
    });
  }
  if (filters.priceMax) {
    chips.push({
      key: "priceMax",
      label: `Under ${formatFilterPriceLabel(filters.priceMax, currency)}`,
      clear: { priceMax: undefined },
    });
  }
  if (filters.mileageMax) {
    chips.push({
      key: "mileageMax",
      label: `Under ${filters.mileageMax.toLocaleString()} ${MILEAGE_UNIT}`,
      clear: { mileageMax: undefined },
    });
  }
  if (filters.bodyType) {
    chips.push({ key: "bodyType", label: filters.bodyType, clear: { bodyType: undefined } });
  }
  if (filters.fuelType) {
    chips.push({ key: "fuelType", label: filters.fuelType, clear: { fuelType: undefined } });
  }
  if (filters.transmission) {
    chips.push({
      key: "transmission",
      label: filters.transmission,
      clear: { transmission: undefined },
    });
  }
  if (filters.condition) {
    chips.push({ key: "condition", label: filters.condition, clear: { condition: undefined } });
  }
  if (filters.location) {
    chips.push({ key: "location", label: filters.location, clear: { location: undefined } });
  }
  if (filters.countryOfOrigin) {
    chips.push({
      key: "countryOfOrigin",
      label: filters.countryOfOrigin === "china" ? "China" : "Japan",
      clear: { countryOfOrigin: undefined },
    });
  }
  if (filters.chineseBrands) {
    chips.push({
      key: "chineseBrands",
      label: "Chinese brands",
      clear: { chineseBrands: undefined },
    });
  }
  if (filters.financingAvailable) {
    chips.push({
      key: "financingAvailable",
      label: "Financing available",
      clear: { financingAvailable: undefined },
    });
  }
  if (filters.customsClearingAvailable) {
    chips.push({
      key: "customsClearingAvailable",
      label: "Customs clearing",
      clear: { customsClearingAvailable: undefined },
    });
  }
  for (const badge of filters.trustBadges ?? []) {
    chips.push({
      key: `trust-${badge}`,
      label: TRUST_BADGE_LABELS[badge],
      clear: {
        trustBadges: filters.trustBadges?.filter((b) => b !== badge),
      },
    });
  }

  return chips;
}

interface ActiveFilterChipsProps {
  className?: string;
}

export function ActiveFilterChips({ className }: ActiveFilterChipsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { currency } = useCurrency();

  const params = Object.fromEntries(searchParams.entries());
  const filters = parseFiltersFromSearchParams(params);
  const sort = (params.sort as SortOption) || "newest";
  const chips = buildChips(filters, currency);

  const updateFilters = useCallback(
    (updates: Partial<VehicleFilters>) => {
      const newFilters = { ...filters, ...updates };
      Object.keys(newFilters).forEach((key) => {
        const k = key as keyof VehicleFilters;
        const val = newFilters[k];
        if (val === undefined || val === "" || (Array.isArray(val) && val.length === 0)) {
          delete newFilters[k];
        }
      });
      const query = buildFilterSearchParams(newFilters, sort);
      startTransition(() => {
        router.push(`${ROUTES.auto.inventory}?${query.toString()}`);
      });
    },
    [filters, sort, router]
  );

  const clearAll = () => {
    startTransition(() => {
      router.push(ROUTES.auto.inventory);
    });
  };

  if (chips.length === 0) return null;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => updateFilters(chip.clear)}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            {chip.label}
            <X className="size-3 opacity-60" />
          </button>
        ))}
        <Button variant="ghost" size="xs" onClick={clearAll} disabled={isPending}>
          Clear all
        </Button>
      </div>
    </div>
  );
}

export { BODY_TYPE_OPTIONS, MILEAGE_FILTER_TIERS, TRUST_BADGE_FILTER_OPTIONS };
