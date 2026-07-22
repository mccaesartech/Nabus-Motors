"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/platform/dashboard/empty-state";
import { MobileSectionCollapse } from "@/components/platform/dashboard/mobile-section-collapse";
import { platformPath } from "@/lib/platform/paths";
import type { ChartTimeRange } from "@/lib/platform/chart-time-range";
import { CHART_TIME_RANGES } from "@/lib/platform/chart-time-range";
import type { DbVehicle, PlatformStats } from "@/lib/platform/types";
import type { PlatformPermission } from "@/lib/platform/permissions";
import { cn } from "@/lib/utils";

const ChartSkeleton = () => (
  <div
    className="h-44 w-full animate-pulse rounded-lg bg-[var(--platform-bg-secondary)]"
    role="status"
    aria-label="Loading chart"
  />
);

const InventoryStatusChart = dynamic(
  () => import("@/components/platform/dashboard-charts").then((m) => m.InventoryStatusChart),
  { loading: ChartSkeleton, ssr: false }
);
const LeadPipelineChart = dynamic(
  () => import("@/components/platform/dashboard-charts").then((m) => m.LeadPipelineChart),
  { loading: ChartSkeleton, ssr: false }
);
const SalesTrendChart = dynamic(
  () => import("@/components/platform/dashboard-charts").then((m) => m.SalesTrendChart),
  { loading: ChartSkeleton, ssr: false }
);
const VehicleCategoriesChart = dynamic(
  () => import("@/components/platform/dashboard-charts").then((m) => m.VehicleCategoriesChart),
  { loading: ChartSkeleton, ssr: false }
);
const RevenueTrendChart = dynamic(
  () => import("@/components/platform/dashboard-charts").then((m) => m.RevenueTrendChart),
  { loading: ChartSkeleton, ssr: false }
);
const FreightStatusChart = dynamic(
  () => import("@/components/platform/dashboard-charts").then((m) => m.FreightStatusChart),
  { loading: ChartSkeleton, ssr: false }
);
const RecentOrdersList = dynamic(
  () => import("@/components/platform/dashboard-charts").then((m) => m.RecentOrdersList),
  { loading: ChartSkeleton, ssr: false }
);
const TopSellingVehicles = dynamic(
  () => import("@/components/platform/dashboard-charts").then((m) => m.TopSellingVehicles),
  { loading: ChartSkeleton, ssr: false }
);
const MonthlyPerformanceSummary = dynamic(
  () => import("@/components/platform/dashboard-charts").then((m) => m.MonthlyPerformanceSummary),
  { loading: ChartSkeleton, ssr: false }
);

type BusinessInsightsProps = {
  stats: PlatformStats | null;
  permissions: Record<PlatformPermission, boolean>;
  vehicles?: DbVehicle[];
  vehiclesLoading?: boolean;
  extras?: {
    pendingShipments?: number;
    delayedShipments?: number;
    freightQuotes?: number;
  };
};

function InsightCard({
  title,
  description,
  children,
  timeRange,
  onTimeRangeChange,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  timeRange?: ChartTimeRange;
  onTimeRangeChange?: (r: ChartTimeRange) => void;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "platform-dashboard-card platform-insight-card min-w-0 max-w-full overflow-x-clip rounded-xl p-3 sm:p-5",
        className
      )}
    >
      <div className="platform-insight-card-header mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[var(--platform-text)]">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-[var(--platform-text-secondary)]">{description}</p>
          )}
        </div>
        {timeRange && onTimeRangeChange && (
          <div
            className="flex w-full min-w-0 max-w-full flex-wrap justify-center gap-1 sm:w-auto lg:justify-start"
            role="group"
            aria-label="Time range"
          >
            {CHART_TIME_RANGES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => onTimeRangeChange(key)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors",
                  timeRange === key
                    ? "bg-[rgba(139,92,246,0.14)] text-[var(--platform-text)]"
                    : "text-[var(--platform-text-secondary)] hover:bg-[rgba(139,92,246,0.06)]"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="platform-insight-card-body min-w-0 w-full max-w-full overflow-x-clip">{children}</div>
    </article>
  );
}

export function BusinessInsights({
  stats,
  permissions,
  vehicles = [],
  vehiclesLoading = false,
  extras,
}: BusinessInsightsProps) {
  const [timeRange, setTimeRange] = useState<ChartTimeRange>("month");

  const showInventory = permissions.inventory;
  const showLeads = permissions.leads;
  const showFreight = permissions.freight;
  const showSales = permissions.sales || permissions.reports;

  const soldVehicles = useMemo(
    () => vehicles.filter((v) => v.status === "sold"),
    [vehicles]
  );

  const hasVehicleData = vehicles.length > 0;
  const hasSalesData = soldVehicles.length > 0;
  const hasFreightData =
    (extras?.pendingShipments ?? 0) > 0 ||
    (extras?.delayedShipments ?? 0) > 0 ||
    (extras?.freightQuotes ?? 0) > 0;

  const inventorySegmentTotal = useMemo(() => {
    if (!stats) return 0;
    return (
      (stats.inventoryChartAvailable ?? stats.availableVehicles ?? 0) +
      (stats.inventoryChartPreOrderPending ?? 0) +
      (stats.inventoryChartPreOrderConfirmed ?? 0) +
      (stats.inventoryChartReserved ?? stats.reservedVehicles ?? 0) +
      (stats.inventoryChartSold ?? stats.soldVehicles ?? 0)
    );
  }, [stats]);

  /** Prefer stage aggregation; fall back to open-inquiry totals so the card never looks blank. */
  const leadPipeline = useMemo(() => {
    if (!stats) {
      return { newLeads: 0, contacted: 0, qualified: 0, won: 0, lost: 0 };
    }

    const stages = {
      newLeads: stats.leadPipelineNew ?? 0,
      contacted: stats.leadPipelineContacted ?? 0,
      qualified: stats.leadPipelineQualified ?? 0,
      won: stats.leadPipelineWon ?? 0,
      lost: stats.leadPipelineLost ?? 0,
    };
    const stageTotal =
      stats.leadPipelineTotal ??
      stages.newLeads + stages.contacted + stages.qualified + stages.won + stages.lost;

    if (stageTotal > 0) return stages;

    const openFallback =
      (stats.newContact ?? 0) +
      (stats.newVehicle ?? 0) +
      (stats.newPreorder ?? 0) +
      (stats.pendingFinance ?? 0) +
      (stats.pendingAppraisal ?? 0);

    if (openFallback > 0) {
      return { newLeads: openFallback, contacted: 0, qualified: 0, won: 0, lost: 0 };
    }

    return stages;
  }, [stats]);

  const row2Mode = useMemo(() => {
    if (showInventory && (hasVehicleData || inventorySegmentTotal > 0)) return "sales";
    if (showFreight || showSales) return "revenue";
    return null;
  }, [showInventory, hasVehicleData, inventorySegmentTotal, showFreight, showSales]);

  const row3Mode = useMemo(() => {
    if (hasSalesData || vehicles.some((v) => v.status === "reserved")) return "orders";
    if (stats) return "performance";
    return null;
  }, [hasSalesData, vehicles, stats]);

  if (!stats) return null;
  if (!showInventory && !showLeads && !row2Mode && !row3Mode) return null;

  return (
    <MobileSectionCollapse
      title="Business insights"
      icon={<TrendingUp className="size-4 shrink-0 text-[var(--platform-accent)]" aria-hidden />}
      className="min-w-0 max-w-full overflow-x-clip"
      headerExtra={
        <Link
          href={platformPath("reports")}
          className="text-xs font-medium text-[var(--platform-accent)] transition-opacity hover:underline"
        >
          View reports
        </Link>
      }
    >
    <div className="grid min-w-0 max-w-full grid-cols-1 gap-3 auto-rows-min sm:gap-4 lg:grid-cols-2 2xl:grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))]">
        {/* Row 1 */}
        {showInventory && (
          <InsightCard
            title="Inventory availability"
            description="Fleet status and pre-order payment pipeline"
            className="lg:col-span-1"
          >
            {inventorySegmentTotal > 0 ? (
              <InventoryStatusChart
                available={stats.inventoryChartAvailable ?? stats.availableVehicles}
                preOrderPending={stats.inventoryChartPreOrderPending ?? 0}
                preOrderConfirmed={stats.inventoryChartPreOrderConfirmed ?? 0}
                reserved={stats.inventoryChartReserved ?? stats.reservedVehicles ?? 0}
                sold={stats.inventoryChartSold ?? stats.soldVehicles ?? 0}
              />
            ) : (
              <EmptyState
                title="No inventory yet"
                description="Add vehicles to your fleet to see availability breakdown."
                actionLabel="Add vehicle"
                actionHref={platformPath("inventory/new")}
                compact
              />
            )}
          </InsightCard>
        )}

        {showLeads && (
          <InsightCard
            title="Lead pipeline"
            description="Inquiry status across contact, vehicle, finance, and pre-order channels"
            className="lg:col-span-1"
          >
            <LeadPipelineChart
              newLeads={leadPipeline.newLeads}
              contacted={leadPipeline.contacted}
              qualified={leadPipeline.qualified}
              won={leadPipeline.won}
              lost={leadPipeline.lost}
            />
          </InsightCard>
        )}

        {/* Row 2 */}
        {row2Mode === "sales" && (
          <>
            <InsightCard
              title="Sales trend"
              description="Sold vehicles over time"
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
            >
              {hasSalesData ? (
                <SalesTrendChart vehicles={soldVehicles} range={timeRange} />
              ) : (
                <EmptyState
                  title="No sales recorded"
                  description="Completed sales will chart here over your selected range."
                  actionLabel="View inventory"
                  actionHref={platformPath("inventory")}
                  compact
                />
              )}
            </InsightCard>
            <InsightCard title="Vehicle categories" description="Fleet mix by body type">
              {hasVehicleData ? (
                <VehicleCategoriesChart vehicles={vehicles} />
              ) : vehiclesLoading ? (
                <ChartSkeleton />
              ) : (
                <EmptyState
                  title="No vehicles to categorize"
                  description="List vehicles with body types to see category distribution."
                  actionLabel="Manage inventory"
                  actionHref={platformPath("inventory")}
                  compact
                />
              )}
            </InsightCard>
          </>
        )}

        {row2Mode === "revenue" && (
          <>
            <InsightCard
              title="Revenue trend"
              description="Estimated revenue from sold vehicles"
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
            >
              {hasSalesData ? (
                <RevenueTrendChart vehicles={soldVehicles} range={timeRange} />
              ) : (
                <EmptyState
                  title="No revenue data"
                  description="Revenue trends appear when vehicles are marked sold."
                  actionLabel="View sales"
                  actionHref={platformPath("sales")}
                  compact
                />
              )}
            </InsightCard>
            {(showFreight || hasFreightData) && (
              <InsightCard title="Freight status" description="Shipments and quote pipeline">
                <FreightStatusChart
                  pending={extras?.pendingShipments ?? 0}
                  delayed={extras?.delayedShipments ?? 0}
                  quotes={extras?.freightQuotes ?? 0}
                />
              </InsightCard>
            )}
          </>
        )}

        {/* Row 3 */}
        {row3Mode === "orders" && (
          <>
            <InsightCard title="Recent orders" description="Latest reserved & sold vehicles">
              <RecentOrdersList vehicles={vehicles} />
            </InsightCard>
            <InsightCard title="Top selling vehicles" description="Best performers by make & model">
              {hasSalesData ? (
                <TopSellingVehicles vehicles={soldVehicles} />
              ) : (
                <EmptyState
                  title="No top sellers yet"
                  description="Sold vehicle rankings will show once you close sales."
                  compact
                />
              )}
            </InsightCard>
          </>
        )}

        {row3Mode === "performance" && stats && (
          <InsightCard
            title="Monthly performance summary"
            description="Key metrics at a glance"
            className="lg:col-span-2"
          >
            <MonthlyPerformanceSummary stats={stats} extras={extras} />
          </InsightCard>
        )}
      </div>
    </MobileSectionCollapse>
  );
}
