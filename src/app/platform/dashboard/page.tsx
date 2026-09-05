"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { WelcomeHeader } from "@/components/platform/dashboard/welcome-header";
import { QuickActions } from "@/components/platform/dashboard/quick-actions";
import { NabusKpiRow } from "@/components/platform/dashboard/nabus-kpi-row";
import { SalesOverviewPanel } from "@/components/platform/dashboard/sales-overview-panel";
import { EnhancedDataTable } from "@/components/platform/enhanced-data-table";
import { StatusBadge } from "@/components/platform/status-badge";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { platformPath } from "@/lib/platform/paths";
import type {
  DashboardRecentTransaction,
  DbVehicle,
  PlatformStats,
  UnifiedLead,
} from "@/lib/platform/types";
import { usePlatformCurrency } from "@/context/platform-currency-context";
import { usePlatformSession } from "@/components/platform/platform-shell";
import { canViewFinance } from "@/lib/platform/permissions";
import { useAdminNotifications } from "@/context/admin-notifications-context";
import { PlatformDateTime } from "@/components/platform/platform-datetime";
import { useAfterIdle } from "@/hooks/use-after-idle";

const ActivityTimeline = dynamic(
  () =>
    import("@/components/platform/dashboard/activity-timeline").then((m) => m.ActivityTimeline),
  {
    loading: () => (
      <div
        className="h-48 animate-pulse rounded-xl bg-[var(--platform-bg-secondary)]"
        role="status"
        aria-label="Loading activity"
      />
    ),
  }
);

const ConfirmDialog = dynamic(
  () => import("@/components/platform/confirm-dialog").then((m) => m.ConfirmDialog),
  { ssr: false }
);

export default function PlatformDashboardPage() {
  const router = useRouter();
  const session = usePlatformSession();
  const { notifications } = useAdminNotifications();
  const idleReady = useAfterIdle(2000);
  const canDeleteTransactions = session?.permissions.trash ?? false;
  const { formatPrice } = usePlatformCurrency();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [chartVehicles, setChartVehicles] = useState<DbVehicle[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<DashboardRecentTransaction[]>([]);
  const [recentLeads, setRecentLeads] = useState<UnifiedLead[]>([]);
  const [activityLog, setActivityLog] = useState<
    Array<{
      id: string;
      action: string;
      actor_name: string | null;
      resource: string | null;
      created_at: string;
    }>
  >([]);
  const [configured, setConfigured] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [coreDataError, setCoreDataError] = useState("");
  const [deleteVehicleTarget, setDeleteVehicleTarget] = useState<DashboardRecentTransaction | null>(
    null
  );
  const [deleteToast, setDeleteToast] = useState("");

  const permissions = session?.permissions;
  const role = session?.role ?? "staff";
  const userName = session?.name ?? "Admin";
  const financeVisible = canViewFinance(role);

  const loadCore = useCallback(async () => {
    setCoreDataError("");
    try {
      const [statsResult, recentResult] = await Promise.allSettled([
        fetch("/api/admin/stats", { cache: "no-store" }),
        fetch("/api/admin/dashboard/recent", { cache: "no-store" }),
      ]);
      const statsRes = statsResult.status === "fulfilled" ? statsResult.value : null;
      const recentRes = recentResult.status === "fulfilled" ? recentResult.value : null;

      if (
        (statsRes && isAdminAuthError(statsRes)) ||
        (recentRes && isAdminAuthError(recentRes))
      ) {
        router.push(adminLoginPath());
        return;
      }

      if (statsRes?.ok) {
        const statsJson = await statsRes.json();
        setConfigured(Boolean(statsJson.configured));
        setStats(statsJson.stats ?? null);
      }

      if (recentRes?.ok) {
        const recentJson = await recentRes.json();
        setConfigured((prev) => prev && Boolean(recentJson.configured));
        setRecentTransactions(recentJson.recentTransactions ?? []);
        setRecentLeads(recentJson.recentLeads ?? []);
      }

      if (!statsRes?.ok || !recentRes?.ok) {
        setCoreDataError(
          "Some dashboard summaries could not refresh. Check your connection and reload."
        );
      }
    } catch {
      setCoreDataError(
        "Dashboard summaries could not refresh. Check your connection and reload."
      );
    } finally {
      setStatsLoading(false);
      setTablesLoading(false);
    }
  }, [router]);

  const insightsLoadedRef = useRef(false);

  const loadInsights = useCallback(async () => {
    if (insightsLoadedRef.current) return;
    insightsLoadedRef.current = true;

    try {
      const [chartResult, activityResult] = await Promise.allSettled([
        fetch("/api/admin/dashboard/chart-vehicles", { cache: "no-store" }),
        permissions?.activity
          ? fetch("/api/admin/activity?limit=15", { cache: "no-store" })
          : Promise.resolve(null),
      ]);
      const chartRes = chartResult.status === "fulfilled" ? chartResult.value : null;
      const activityRes =
        activityResult.status === "fulfilled" ? activityResult.value : null;

      if (
        (chartRes && isAdminAuthError(chartRes)) ||
        (activityRes && isAdminAuthError(activityRes))
      ) {
        router.push(adminLoginPath());
        return;
      }

      if (chartRes?.ok) {
        const chartJson = await chartRes.json();
        setChartVehicles(chartJson.vehicles ?? []);
      }

      if (activityRes?.ok) {
        const activityJson = await activityRes.json();
        setActivityLog(activityJson.activity ?? []);
      }
    } catch {
      // Core dashboard summaries remain useful if chart data is unavailable.
    } finally {
      setInsightsLoading(false);
    }
  }, [permissions?.activity, router]);

  useEffect(() => {
    if (session) void loadCore();
  }, [loadCore, session]);

  useEffect(() => {
    if (session && idleReady) void loadInsights();
  }, [idleReady, loadInsights, session]);

  async function dismissTransaction(vehicleId: string) {
    const res = await fetch("/api/admin/dashboard/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId }),
    });
    const json = await res.json();
    if (res.ok) {
      setDeleteToast("Removed from recent orders. The vehicle stays in inventory.");
      setRecentTransactions((prev) => prev.filter((v) => v.id !== vehicleId));
    } else {
      setDeleteToast(json.message ?? "Could not remove from recent orders.");
    }
  }

  if (!permissions) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading dashboard">
        <div className="h-32 animate-pulse rounded-2xl bg-[var(--platform-bg-secondary)]" />
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-5 sm:space-y-6">
      <WelcomeHeader userName={userName} role={role} />

      {!configured && (
        <div
          className="rounded-lg border border-[var(--platform-warning)]/30 bg-[rgba(224,167,35,0.08)] px-4 py-3 text-sm text-[var(--platform-warning)]"
          role="alert"
        >
          Database not connected. Configure Supabase env vars and redeploy.
        </div>
      )}

      {deleteToast && (
        <div
          className="rounded-lg border border-[var(--platform-success)]/30 bg-[rgba(22,163,74,0.08)] px-4 py-3 text-sm text-[var(--platform-success)]"
          role="status"
        >
          {deleteToast}
        </div>
      )}

      {coreDataError ? (
        <div
          className="rounded-lg border border-[var(--platform-warning)]/30 bg-[rgba(224,167,35,0.08)] px-4 py-3 text-sm text-[var(--platform-text)]"
          role="status"
        >
          {coreDataError}
        </div>
      ) : null}

      <QuickActions permissions={permissions} role={role} />

      <NabusKpiRow stats={stats} role={role} loading={statsLoading || !stats} />

      <div className="grid min-w-0 max-w-full auto-rows-min gap-4 xl:grid-cols-2 2xl:gap-5">
        <SalesOverviewPanel
          vehicles={chartVehicles}
          loading={insightsLoading && chartVehicles.length === 0}
        />
        <section
          aria-label="Recent activity"
          className="platform-card min-w-0 max-w-full overflow-x-clip rounded-xl p-4 sm:p-5"
        >
          <h2 className="text-sm font-semibold text-[var(--platform-text)]">Recent Activity</h2>
          <p className="mt-0.5 mb-4 text-xs text-[var(--platform-text-secondary)]">
            Latest leads, notifications, and team actions
          </p>
          <ActivityTimeline
            notifications={notifications}
            recentLeads={recentLeads}
            activityLog={activityLog}
            loading={tablesLoading || insightsLoading}
          />
        </section>
      </div>

      <section aria-label="Recent orders" className="min-w-0 max-w-full space-y-3 overflow-x-clip">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--platform-text)]">Recent Orders</h2>
            <p className="text-xs text-[var(--platform-text-secondary)]">
              Reserved, sold, and confirmed pre-order vehicles
            </p>
          </div>
          <Link
            href={platformPath("leads?tab=order")}
            className="shrink-0 text-xs font-medium text-[var(--platform-accent)] hover:underline"
          >
            View all orders
          </Link>
        </div>
        <EnhancedDataTable
          columns={[
            {
              id: "vehicle",
              header: "Vehicle",
              sortable: true,
              sortValue: (v) => `${v.year} ${v.make} ${v.model}`,
              accessor: (v) => (
                <span className="break-words">
                  {v.year} {v.make} {v.model}
                </span>
              ),
            },
            ...(financeVisible
              ? [
                  {
                    id: "price",
                    header: "Price",
                    sortable: true,
                    sortValue: (v: DashboardRecentTransaction) => v.price,
                    accessor: (v: DashboardRecentTransaction) => (
                      <span className="tabular-nums">{formatPrice(v.price)}</span>
                    ),
                  },
                ]
              : []),
            {
              id: "status",
              header: "Status",
              accessor: (v) => <StatusBadge status={v.status} />,
            },
            {
              id: "listed",
              header: "Listed",
              sortable: true,
              sortValue: (v) => v.created_at ?? "",
              accessor: (v) => (
                <PlatformDateTime
                  value={v.created_at}
                  className="text-xs text-[var(--platform-text-secondary)]"
                />
              ),
            },
            ...(canDeleteTransactions
              ? [
                  {
                    id: "actions",
                    header: "",
                    defaultVisible: true,
                    accessor: (v: DashboardRecentTransaction) => (
                      <button
                        type="button"
                        className="platform-btn-ghost text-[var(--platform-error)]"
                        title="Remove from recent orders"
                        aria-label="Remove from recent orders"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteVehicleTarget(v);
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    ),
                  },
                ]
              : []),
          ]}
          data={recentTransactions}
          rowKey={(v) => v.id}
          emptyMessage={
            tablesLoading
              ? "Loading recent orders…"
              : "No reserved, sold, or confirmed pre-order vehicles yet."
          }
          loading={tablesLoading}
          pageSize={8}
          hideSearch
          minWidth="36rem"
        />
      </section>

      <ConfirmDialog
        open={Boolean(deleteVehicleTarget)}
        onOpenChange={(open) => !open && setDeleteVehicleTarget(null)}
        title="Remove from recent orders?"
        description={
          deleteVehicleTarget
            ? `${deleteVehicleTarget.year} ${deleteVehicleTarget.make} ${deleteVehicleTarget.model} will be hidden from this list only. The vehicle remains in inventory.`
            : ""
        }
        confirmLabel="Remove from list"
        destructive
        onConfirm={async () => {
          if (deleteVehicleTarget) await dismissTransaction(deleteVehicleTarget.id);
        }}
      />
    </div>
  );
}
