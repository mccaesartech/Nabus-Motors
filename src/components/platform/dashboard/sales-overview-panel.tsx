"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import Link from "next/link";
import { CHART_TIME_RANGES, type ChartTimeRange } from "@/lib/platform/chart-time-range";
import { platformPath } from "@/lib/platform/paths";
import type { DbVehicle } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

const SalesTrendChart = dynamic(
  () => import("@/components/platform/dashboard-charts").then((m) => m.SalesTrendChart),
  {
    loading: () => (
      <div
        className="h-48 animate-pulse rounded-lg bg-[var(--platform-bg)]"
        role="status"
        aria-label="Loading sales chart"
      />
    ),
    ssr: false,
  }
);

type SalesOverviewPanelProps = {
  vehicles: DbVehicle[];
  loading?: boolean;
};

export function SalesOverviewPanel({ vehicles, loading }: SalesOverviewPanelProps) {
  const [range, setRange] = useState<ChartTimeRange>("month");
  const soldVehicles = vehicles.filter((v) => v.status === "sold");

  return (
    <section
      aria-label="Sales overview"
      className="platform-card flex min-w-0 flex-col rounded-xl p-4 sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--platform-text)]">Sales Overview</h2>
          <p className="mt-0.5 text-xs text-[var(--platform-text-secondary)]">
            Sold vehicles over time
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {CHART_TIME_RANGES.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setRange(option.key)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                range === option.key
                  ? "bg-[rgba(183,25,46,0.1)] text-[var(--platform-accent)]"
                  : "text-[var(--platform-text-secondary)] hover:text-[var(--platform-text)]"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div
          className="h-48 animate-pulse rounded-lg bg-[var(--platform-bg)]"
          role="status"
          aria-label="Loading sales chart"
        />
      ) : soldVehicles.length > 0 ? (
        <SalesTrendChart vehicles={soldVehicles} range={range} />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <p className="text-sm font-medium text-[var(--platform-text)]">No sales recorded yet</p>
          <p className="text-xs text-[var(--platform-text-secondary)]">
            Completed sales will appear here.
          </p>
          <Link
            href={platformPath("inventory")}
            className="mt-2 text-xs font-semibold text-[var(--platform-accent)] hover:underline"
          >
            View inventory
          </Link>
        </div>
      )}
    </section>
  );
}
