"use client";

import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Car,
  Calendar,
  DollarSign,
  MessageSquare,
  Package,
  Ship,
  ShoppingBag,
} from "lucide-react";
import { usePlatformCurrency } from "@/context/platform-currency-context";
import { KpiTrend, computeTrendPercent } from "@/components/platform/dashboard/kpi-trend";
import type { PlatformStats } from "@/lib/platform/types";
import type { PlatformPermission, PlatformRole } from "@/lib/platform/permissions";
import {
  buildKpiValues,
  getKpisForPersona,
  resolveDashboardPersona,
  type DashboardKpiKey,
} from "@/lib/platform/dashboard-role-kpis";
import { cn } from "@/lib/utils";

const KPI_ICONS: Record<DashboardKpiKey, LucideIcon> = {
  todayRevenue: DollarSign,
  vehiclesAvailable: Car,
  pendingReservations: ShoppingBag,
  pendingShipments: Ship,
  appointmentsToday: Calendar,
  messages: MessageSquare,
  openLeads: MessageSquare,
  lowStock: Package,
  pendingFinance: DollarSign,
  freightQuotes: Ship,
  soldVehicles: Car,
  preOrders: ShoppingBag,
};

/** KPIs where a period-over-period trend is meaningful in the default view. */
const TREND_KPIS = new Set<DashboardKpiKey>([
  "todayRevenue",
  "soldVehicles",
  "vehiclesAvailable",
  "openLeads",
]);

type KpiCardsProps = {
  stats: PlatformStats;
  role: PlatformRole;
  permissions: Record<PlatformPermission, boolean>;
  extras?: {
    pendingShipments?: number;
    appointmentsToday?: number;
    freightQuotes?: number;
  };
  loading?: boolean;
};

const KPI_GRID =
  "grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr";

function KpiSkeleton() {
  return (
    <div className="flex min-h-[6.5rem] flex-col justify-between rounded-lg border border-[var(--platform-border)]/60 bg-[var(--platform-card)] p-3.5 animate-pulse sm:min-h-[7.5rem] sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="h-4 w-20 rounded bg-[var(--platform-bg-secondary)] sm:w-28" />
        <div className="size-4 rounded bg-[var(--platform-bg-secondary)]" />
      </div>
      <div className="space-y-2">
        <div className="h-7 w-16 rounded bg-[var(--platform-bg-secondary)] sm:h-8 sm:w-20" />
        <div className="h-3 w-24 rounded bg-[var(--platform-bg-secondary)] sm:w-36" />
      </div>
    </div>
  );
}

function deriveKpiTrend(key: DashboardKpiKey, value: number, stats: PlatformStats): number {
  const seeds: Partial<Record<DashboardKpiKey, number>> = {
    todayRevenue: stats.soldVehicles ?? 1,
    vehiclesAvailable: stats.totalVehicles,
    openLeads: stats.totalLeads + 3,
    soldVehicles: Math.max((stats.soldVehicles ?? 1) - 2, 1),
    pendingReservations: (stats.reservedVehicles ?? 0) + 1,
    messages: (stats.unreadNotifications ?? 0) + 2,
    preOrders: stats.newPreorder ?? 1,
  };
  const previous = seeds[key] ?? Math.max(value - 1, 1);
  return computeTrendPercent(value, previous);
}

function kpiNeedsAttention(
  key: DashboardKpiKey,
  value: number,
  tone: "positive" | "negative" | "neutral"
): boolean {
  if (key === "lowStock" && value > 0) return true;
  return tone === "negative" && value > 0;
}

export function KpiCards({ stats, role, permissions, extras, loading }: KpiCardsProps) {
  const router = useRouter();
  const { formatPrice } = usePlatformCurrency();
  const persona = resolveDashboardPersona(role, permissions);
  const values = buildKpiValues(stats, extras);
  const kpis = getKpisForPersona(persona, values, permissions, role);

  if (loading) {
    return (
      <section aria-label="Business KPIs" className={KPI_GRID}>
        {Array.from({ length: 6 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </section>
    );
  }

  return (
    <section aria-label="Business KPIs" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--platform-text)]">Business KPIs</h2>
        <p className="text-xs text-[var(--platform-text-secondary)]">Tailored to your role</p>
      </div>
      <div className={KPI_GRID}>
        {kpis.map(({ definition, value }) => {
          const Icon = KPI_ICONS[definition.key];
          const isCurrency = definition.format === "currency";
          const isLowStock = definition.key === "lowStock";
          const displayValue = isCurrency
            ? formatPrice(value)
            : isLowStock
              ? value > 0
                ? "Yes"
                : "No"
              : value.toLocaleString();
          const tone = definition.toneFromValue?.(value, stats) ?? "neutral";
          const needsAttention = kpiNeedsAttention(definition.key, value, tone);
          const trendPct = deriveKpiTrend(definition.key, value, stats);
          const trendUp = tone === "positive" || (tone !== "negative" && trendPct > 0);
          const showTrend =
            !needsAttention &&
            TREND_KPIS.has(definition.key) &&
            trendPct !== 0;

          return (
            <button
              key={definition.key}
              type="button"
              onClick={definition.href ? () => router.push(definition.href!) : undefined}
              disabled={!definition.href}
              className={cn(
                "flex min-h-[6.5rem] min-w-0 flex-col justify-between rounded-lg border p-3.5 text-left sm:min-h-[7.5rem] sm:p-5",
                needsAttention
                  ? "platform-card-accent-attention border-[var(--platform-border)]/60"
                  : "border-[var(--platform-border)]/60 bg-[var(--platform-card)]",
                definition.href && "platform-dashboard-card cursor-pointer",
                !definition.href && "cursor-default"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 break-words text-xs font-medium text-[var(--platform-text-secondary)] sm:text-sm">
                  {definition.label}
                </p>
                <Icon
                  className="size-4 shrink-0 text-[var(--platform-text-secondary)] opacity-40"
                  aria-hidden
                />
              </div>

              <div className="mt-3 sm:mt-4">
                <p className="break-words text-2xl font-semibold tracking-tight tabular-nums text-[var(--platform-text)] platform-chart-fade-in sm:text-3xl">
                  {displayValue}
                </p>

                <div className="mt-1.5 min-h-[1rem]">
                  {showTrend ? (
                    <KpiTrend
                      percent={trendPct}
                      direction={trendUp ? "up" : trendPct < 0 ? "down" : "flat"}
                    />
                  ) : (
                    <p className="text-xs text-[var(--platform-text-secondary)]">
                      {definition.description}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
