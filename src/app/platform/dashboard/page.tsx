"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/platform/status-badge";
import { WelcomeHeader } from "@/components/platform/dashboard/welcome-header";
import { KpiCards } from "@/components/platform/dashboard/kpi-cards";
import { QuickActions } from "@/components/platform/dashboard/quick-actions";
import { AttentionCenter } from "@/components/platform/dashboard/attention-center";
import { EnhancedDataTable } from "@/components/platform/enhanced-data-table";
import { DeferredSection } from "@/components/shared/deferred-section";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { platformPath } from "@/lib/platform/paths";
import type {
  DashboardRecentTransaction,
  DbVehicle,
  PlatformStats,
  UnifiedLead,
} from "@/lib/platform/types";
import { leadTypeLabel } from "@/lib/platform/types";
import { PaymentStatusBadge } from "@/components/platform/status-badge";
import { usePlatformCurrency } from "@/context/platform-currency-context";
import { usePlatformSession } from "@/components/platform/platform-shell";
import { useAdminNotifications } from "@/context/admin-notifications-context";
import { PlatformDateTime } from "@/components/platform/platform-datetime";
import { useAfterIdle } from "@/hooks/use-after-idle";

const BusinessInsights = dynamic(
  () =>
    import("@/components/platform/dashboard/business-insights").then((m) => m.BusinessInsights),
  {
    loading: () => (
      <div
        className="h-64 animate-pulse rounded-xl bg-[var(--platform-bg-secondary)]"
        role="status"
        aria-label="Loading insights"
      />
    ),
    ssr: false,
  }
);

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

type DashboardExtras = {
  pendingShipments: number;
  delayedShipments: number;
  appointmentsToday: number;
  freightQuotes: number;
  failedPayments: number;
};

const EMPTY_EXTRAS: DashboardExtras = {
  pendingShipments: 0,
  delayedShipments: 0,
  appointmentsToday: 0,
  freightQuotes: 0,
  failedPayments: 0,
};

const SectionSkeleton = ({ className = "h-64" }: { className?: string }) => (
  <div
    className={`animate-pulse rounded-xl bg-[var(--platform-bg-secondary)] ${className}`}
    role="status"
    aria-label="Loading section"
  />
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
  const [extras, setExtras] = useState<DashboardExtras>(EMPTY_EXTRAS);
  const [configured, setConfigured] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [coreDataError, setCoreDataError] = useState("");
  const [insightsError, setInsightsError] = useState("");
  const [deleteVehicleTarget, setDeleteVehicleTarget] = useState<DashboardRecentTransaction | null>(
    null
  );
  const [deleteToast, setDeleteToast] = useState("");

  const permissions = session?.permissions;
  const role = session?.role ?? "staff";
  const userName = session?.name ?? "Admin";

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
        setExtras((prev) => ({
          ...prev,
          failedPayments: recentJson.failedPayments ?? prev.failedPayments,
        }));
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

  const loadExtras = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dashboard/extras", { cache: "no-store" });
      if (res.ok) {
        const extrasJson = await res.json();
        setExtras(extrasJson.extras ?? EMPTY_EXTRAS);
      }
    } catch {
      // Core dashboard summaries remain useful if optional extras are unavailable.
    }
  }, []);

  const insightsLoadedRef = useRef(false);

  const loadInsights = useCallback(async () => {
    if (insightsLoadedRef.current) return;
    insightsLoadedRef.current = true;
    setInsightsError("");

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

      if (!chartRes?.ok || (permissions?.activity && !activityRes?.ok)) {
        setInsightsError(
          "Detailed chart data could not fully refresh. Core availability and lead summaries are still shown."
        );
      }
    } catch {
      setInsightsError(
        "Detailed chart data could not refresh. Core availability and lead summaries are still shown."
      );
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

  useEffect(() => {
    if (session && idleReady) void loadExtras();
  }, [idleReady, loadExtras, session]);

  const formatCurrency = (n: number) => formatPrice(n);

  async function dismissTransaction(vehicleId: string) {
    const res = await fetch("/api/admin/dashboard/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId }),
    });
    const json = await res.json();
    if (res.ok) {
      setDeleteToast("Removed from recent transactions. The vehicle stays in your fleet inventory.");
      setRecentTransactions((prev) => prev.filter((v) => v.id !== vehicleId));
    } else {
      setDeleteToast(json.message ?? "Could not remove from recent transactions.");
    }
  }

  const businessSummary = useMemo(() => {
    if (!stats) return undefined;
    const parts: string[] = [];
    if (stats.totalLeads > 0) parts.push(`${stats.totalLeads} open lead${stats.totalLeads !== 1 ? "s" : ""}`);
    if (extras.appointmentsToday > 0)
      parts.push(`${extras.appointmentsToday} appointment${extras.appointmentsToday !== 1 ? "s" : ""} today`);
    if (stats.availableVehicles > 0)
      parts.push(`${stats.availableVehicles} vehicle${stats.availableVehicles !== 1 ? "s" : ""} available`);
    return parts.length
      ? `${parts.join(" · ")}. Review priorities below.`
      : undefined;
  }, [stats, extras.appointmentsToday]);

  if (!permissions) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading dashboard">
        <div className="h-32 animate-pulse rounded-2xl bg-[var(--platform-bg-secondary)]" />
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-5">
      <WelcomeHeader
        userName={userName}
        role={role}
        permissions={permissions}
        businessSummary={businessSummary}
      />

      {!configured && (
        <div
          className="rounded-lg border border-[var(--platform-warning)]/30 bg-[rgba(245,158,11,0.08)] px-4 py-3 text-sm text-[var(--platform-warning)]"
          role="alert"
        >
          Database not connected. Configure Supabase env vars and redeploy.
        </div>
      )}

      {deleteToast && (
        <div
          className="rounded-lg border border-[var(--platform-success)]/30 bg-[rgba(16,185,129,0.08)] px-4 py-3 text-sm text-[var(--platform-success)]"
          role="status"
        >
          {deleteToast}
        </div>
      )}

      {coreDataError ? (
        <div
          className="rounded-lg border border-[var(--platform-warning)]/30 bg-[rgba(245,158,11,0.08)] px-4 py-3 text-sm text-[var(--platform-text)]"
          role="status"
        >
          {coreDataError}
        </div>
      ) : null}

      <KpiCards
        stats={stats ?? ({} as PlatformStats)}
        role={role}
        permissions={permissions}
        extras={extras}
        loading={statsLoading || !stats}
      />

      <QuickActions permissions={permissions} />

      <AttentionCenter
        stats={stats}
        notifications={notifications}
        permissions={permissions}
        extras={extras}
      />

      {insightsError ? (
        <p className="text-xs leading-5 text-[var(--platform-text-secondary)]" role="status">
          {insightsError}
        </p>
      ) : null}

      <InsightsSection
        stats={stats}
        permissions={permissions}
        chartVehicles={chartVehicles}
        extras={extras}
        notifications={notifications}
        recentLeads={recentLeads}
        activityLog={activityLog}
        tablesLoading={tablesLoading}
        insightsLoading={insightsLoading}
      />

      <DeferredSection
        fallback={
          <div className="grid min-w-0 gap-4 xl:grid-cols-2 2xl:gap-5">
            <SectionSkeleton className="h-72" />
            <SectionSkeleton className="h-72" />
          </div>
        }
      >
        <DashboardTablesSection
          recentTransactions={recentTransactions}
          recentLeads={recentLeads}
          tablesLoading={tablesLoading}
          canDeleteTransactions={canDeleteTransactions}
          formatCurrency={formatCurrency}
          onDeleteTarget={setDeleteVehicleTarget}
        />
      </DeferredSection>

      <ConfirmDialog
        open={Boolean(deleteVehicleTarget)}
        onOpenChange={(open) => !open && setDeleteVehicleTarget(null)}
        title="Remove from recent transactions?"
        description={
          deleteVehicleTarget
            ? `${deleteVehicleTarget.year} ${deleteVehicleTarget.make} ${deleteVehicleTarget.model} will be hidden from this dashboard list only. The vehicle remains in inventory and fleet counts — it is not moved to Trash.`
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

type InsightsSectionProps = {
  stats: PlatformStats | null;
  permissions: NonNullable<ReturnType<typeof usePlatformSession>>["permissions"];
  chartVehicles: DbVehicle[];
  extras: DashboardExtras;
  notifications: ReturnType<typeof useAdminNotifications>["notifications"];
  recentLeads: UnifiedLead[];
  activityLog: Array<{
    id: string;
    action: string;
    actor_name: string | null;
    resource: string | null;
    created_at: string;
  }>;
  tablesLoading: boolean;
  insightsLoading: boolean;
};

function InsightsSection({
  stats,
  permissions,
  chartVehicles,
  extras,
  notifications,
  recentLeads,
  activityLog,
  tablesLoading,
  insightsLoading,
}: InsightsSectionProps) {
  return (
    <div className="grid min-w-0 max-w-full auto-rows-min gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)] 2xl:gap-5">
      <div className="min-w-0 max-w-full overflow-x-clip">
        <ActivityTimeline
          notifications={notifications}
          recentLeads={recentLeads}
          activityLog={activityLog}
          loading={tablesLoading || insightsLoading}
        />
      </div>

      <div className="min-w-0 max-w-full overflow-x-clip">
        {stats ? (
          <BusinessInsights
            stats={stats}
            permissions={permissions}
            vehicles={chartVehicles}
            vehiclesLoading={insightsLoading}
            extras={extras}
          />
        ) : (
          <SectionSkeleton className="h-80" />
        )}
      </div>
    </div>
  );
}

type DashboardTablesSectionProps = {
  recentTransactions: DashboardRecentTransaction[];
  recentLeads: UnifiedLead[];
  tablesLoading: boolean;
  canDeleteTransactions: boolean;
  formatCurrency: (n: number) => string;
  onDeleteTarget: (v: DashboardRecentTransaction) => void;
};

function DashboardTablesSection({
  recentTransactions,
  recentLeads,
  tablesLoading,
  canDeleteTransactions,
  formatCurrency,
  onDeleteTarget,
}: DashboardTablesSectionProps) {
  return (
    <div className="grid min-w-0 max-w-full gap-4 xl:grid-cols-2 2xl:gap-5">
      <section aria-label="Recent transactions" className="min-w-0 max-w-full space-y-3 overflow-x-clip">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--platform-text)]">Recent transactions</h2>
          <Link
            href={platformPath("inventory")}
            className="shrink-0 text-xs font-medium text-[var(--platform-accent)] hover:underline"
          >
            View inventory
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
            {
              id: "price",
              header: "Price",
              sortable: true,
              sortValue: (v) => v.price,
              accessor: (v) => <span className="tabular-nums">{formatCurrency(v.price)}</span>,
            },
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
                <PlatformDateTime value={v.created_at} className="text-xs text-[var(--platform-text-secondary)]" />
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
                        className="platform-btn-ghost text-[var(--platform-danger)]"
                        title="Remove from recent transactions"
                        aria-label="Remove from recent transactions"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTarget(v);
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
              ? "Loading recent transactions…"
              : "No reserved, sold, or confirmed pre-order vehicles yet."
          }
          loading={tablesLoading}
          pageSize={6}
          hideSearch
          minWidth="36rem"
        />
      </section>

      <section aria-label="Lead tracking" className="min-w-0 max-w-full space-y-3 overflow-x-clip">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--platform-text)]">Lead tracking</h2>
          <Link
            href={platformPath("leads")}
            className="shrink-0 text-xs font-medium text-[var(--platform-accent)] hover:underline"
          >
            Manage leads
          </Link>
        </div>
        <EnhancedDataTable
          columns={[
            {
              id: "contact",
              header: "Contact",
              sortable: true,
              sortValue: (lead) => lead.name,
              accessor: (lead) => <LeadContactCell lead={lead} />,
            },
            {
              id: "type",
              header: "Type",
              accessor: (lead) => leadTypeLabel(lead.type),
            },
            {
              id: "status",
              header: "Status",
              accessor: (lead) => (
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={lead.status} />
                  {lead.paymentStatus && <PaymentStatusBadge status={lead.paymentStatus} />}
                </div>
              ),
            },
            {
              id: "submitted",
              header: "Submitted",
              sortable: true,
              sortValue: (lead) => lead.createdAt,
              accessor: (lead) => (
                <PlatformDateTime value={lead.createdAt} className="text-xs text-[var(--platform-text-secondary)]" />
              ),
            },
          ]}
          data={recentLeads}
          rowKey={(lead) => `${lead.type}-${lead.id}`}
          emptyMessage={tablesLoading ? "Loading leads…" : "No leads captured yet."}
          loading={tablesLoading}
          pageSize={6}
          hideSearch
          minWidth="36rem"
        />
      </section>
    </div>
  );
}

const LeadContactCell = memo(function LeadContactCell({ lead }: { lead: UnifiedLead }) {
  return (
    <div>
      {lead.detailLink ? (
        <Link href={lead.detailLink} className="font-medium text-[var(--platform-accent)] hover:underline">
          {lead.name}
        </Link>
      ) : (
        <Link
          href={`${platformPath("leads")}?tab=${lead.type}`}
          className="font-medium text-[var(--platform-accent)] hover:underline"
        >
          {lead.name}
        </Link>
      )}
      <p className="text-xs text-[var(--platform-text-secondary)]">
        {lead.vehicleTitle ?? lead.summary.slice(0, 48)}
      </p>
    </div>
  );
});
