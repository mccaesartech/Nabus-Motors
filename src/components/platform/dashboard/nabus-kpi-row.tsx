"use client";

import { Car, DollarSign, MessageSquare, ShoppingBag } from "lucide-react";
import { NabusDashboardCard } from "@/components/nabus/nabus-dashboard-card";
import { usePlatformCurrency } from "@/context/platform-currency-context";
import { canViewFinance } from "@/lib/platform/permissions";
import type { PlatformStats } from "@/lib/platform/types";
import type { PlatformRole } from "@/lib/platform/permissions";

type NabusKpiRowProps = {
  stats: PlatformStats | null;
  role: PlatformRole;
  loading?: boolean;
};

function KpiSkeleton() {
  return (
    <div className="h-[7.5rem] animate-pulse rounded-xl border border-[var(--platform-border)] bg-[var(--platform-card)]" />
  );
}

export function NabusKpiRow({ stats, role, loading }: NabusKpiRowProps) {
  const { formatPrice } = usePlatformCurrency();
  const financeVisible = canViewFinance(role);

  if (loading || !stats) {
    return (
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </section>
    );
  }

  const activeOrders =
    (stats.reservedVehicles ?? 0) +
    (stats.inventoryChartPreOrderPending ?? 0) +
    (stats.inventoryChartPreOrderConfirmed ?? 0);

  return (
    <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <NabusDashboardCard
        title="Vehicles Available"
        value={stats.availableVehicles.toLocaleString()}
        description="Ready for sale"
        icon={Car}
      />
      <NabusDashboardCard
        title="New Leads"
        value={stats.totalLeads.toLocaleString()}
        description="Open inquiries"
        icon={MessageSquare}
      />
      <NabusDashboardCard
        title="Active Orders"
        value={activeOrders.toLocaleString()}
        description="Reserved & pre-orders"
        icon={ShoppingBag}
      />
      <NabusDashboardCard
        title="Revenue"
        value={financeVisible ? formatPrice(stats.estimatedRevenue) : "—"}
        description={financeVisible ? "From sold vehicles" : "Restricted"}
        icon={DollarSign}
      />
    </section>
  );
}
