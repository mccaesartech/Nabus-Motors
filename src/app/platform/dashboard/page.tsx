"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Car,
  DollarSign,
  MessageSquare,
  Plus,
  ShoppingBag,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { PageHeader, StatCard } from "@/components/platform/page-header";
import { ConfirmDialog } from "@/components/platform/confirm-dialog";
import {
  InventoryStatusChart,
  LeadPipelineChart,
} from "@/components/platform/dashboard-charts";
import { StatusBadge } from "@/components/platform/status-badge";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { platformPath } from "@/lib/platform/paths";
import type { AdminNotification, DbVehicle, InquiryData, PlatformStats } from "@/lib/platform/types";
import { leadTypeLabel } from "@/lib/platform/types";
import { unifyLeads } from "@/lib/platform/data";
import { PreorderNotificationPreview } from "@/components/platform/preorder-notification-preview";
import { PaymentStatusBadge } from "@/components/platform/status-badge";
import { usePlatformCurrency } from "@/context/platform-currency-context";
import { usePlatformSession } from "@/components/platform/platform-shell";
import { PlatformDateTime } from "@/components/platform/platform-datetime";

export default function PlatformDashboardPage() {
  const router = useRouter();
  const session = usePlatformSession();
  const canEditInventory = session?.permissions.inventory_edit ?? false;
  const canDeleteTransactions = session?.permissions.trash ?? false;
  const { formatPrice } = usePlatformCurrency();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [vehicles, setVehicles] = useState<DbVehicle[]>([]);
  const [inquiries, setInquiries] = useState<InquiryData | null>(null);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [deleteVehicleTarget, setDeleteVehicleTarget] = useState<DbVehicle | null>(null);
  const [deleteToast, setDeleteToast] = useState("");
  const [dismissedTransactionIds, setDismissedTransactionIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [statsRes, vehiclesRes, inquiriesRes, notificationsRes, dismissalsRes] = await Promise.all([
      fetch("/api/admin/stats"),
      fetch("/api/admin/vehicles"),
      fetch("/api/admin/inquiries"),
      fetch("/api/admin/notifications?limit=5"),
      fetch("/api/admin/dashboard/transactions"),
    ]);

    if (isAdminAuthError(statsRes) || isAdminAuthError(vehiclesRes) || isAdminAuthError(inquiriesRes)) {
      router.push(adminLoginPath());
      return;
    }

    if (!statsRes.ok || !vehiclesRes.ok || !inquiriesRes.ok) {
      setLoading(false);
      return;
    }

    const statsJson = await statsRes.json();
    const vehiclesJson = await vehiclesRes.json();
    const inquiriesJson = await inquiriesRes.json();
    const notificationsJson = notificationsRes.ok ? await notificationsRes.json() : { notifications: [] };
    const dismissalsJson = dismissalsRes.ok ? await dismissalsRes.json() : { dismissedVehicleIds: [] };

    setConfigured(
      Boolean(statsJson.configured && vehiclesJson.configured && inquiriesJson.configured)
    );
    setStats(statsJson.stats ?? null);
    setVehicles(vehiclesJson.vehicles ?? []);
    setInquiries(inquiriesJson.data ?? {});
    setNotifications(notificationsJson.notifications ?? []);
    setDismissedTransactionIds(new Set(dismissalsJson.dismissedVehicleIds ?? []));
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const recentLeads = inquiries ? unifyLeads(inquiries).slice(0, 6) : [];

  const confirmedPreorderVehicleIds = new Set(
    (inquiries?.preorder ?? [])
      .filter(
        (row) =>
          row.payment_status === "down_payment_paid" &&
          typeof row.vehicle_id === "string" &&
          row.vehicle_id
      )
      .map((row) => row.vehicle_id as string)
  );

  const recentTransactions = vehicles
    .filter(
      (v) =>
        !dismissedTransactionIds.has(v.id) &&
        (v.status === "sold" ||
          v.status === "reserved" ||
          confirmedPreorderVehicleIds.has(v.id))
    )
    .slice(0, 6);

  const activePreOrderCount =
    (stats?.inventoryChartPreOrderPending ?? 0) +
    (stats?.inventoryChartPreOrderConfirmed ?? 0);
  const downPaymentsConfirmed = stats?.downPaymentPaidCount ?? 0;

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
      load();
    } else {
      setDeleteToast(json.message ?? "Could not remove from recent transactions.");
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading dashboard…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Operational overview of inventory, sales pipeline, and customer activity."
        breadcrumb="Platform"
        showBack={false}
      />

      {!configured && (
        <div className="rounded-lg border border-[var(--platform-warning)]/30 bg-[rgba(245,158,11,0.08)] px-4 py-3 text-sm text-[var(--platform-warning)]">
          Database not connected. Configure Supabase env vars and redeploy.
        </div>
      )}

      {deleteToast && (
        <div className="rounded-lg border border-[var(--platform-success)]/30 bg-[rgba(16,185,129,0.08)] px-4 py-3 text-sm text-[var(--platform-success)]">
          {deleteToast}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {canEditInventory && (
          <Link
            href={platformPath("inventory/new")}
            className="platform-card group flex items-center gap-4 rounded-xl p-4 transition-colors hover:border-[#c4b5fd]"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[rgba(139,92,246,0.12)] text-[var(--platform-accent)]">
              <Plus className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-[var(--platform-text)]">Add vehicle</span>
              <span className="text-xs text-[var(--platform-text-secondary)]">List a new car for sale</span>
            </span>
          </Link>
        )}
        <Link
          href={`${platformPath("leads")}?status=new`}
          className="platform-card group flex items-center gap-4 rounded-xl p-4 transition-colors hover:border-[#c4b5fd]"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[rgba(139,92,246,0.12)] text-[var(--platform-accent)]">
            <MessageSquare className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-[var(--platform-text)]">View leads</span>
            <span className="text-xs text-[var(--platform-text-secondary)]">Follow up on inquiries</span>
          </span>
        </Link>
        <Link
          href={`${platformPath("leads")}?tab=preorder`}
          className="platform-card group flex items-center gap-4 rounded-xl p-4 transition-colors hover:border-[#c4b5fd]"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[rgba(139,92,246,0.12)] text-[var(--platform-accent)]">
            <ShoppingBag className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-[var(--platform-text)]">Pre-orders</span>
            <span className="text-xs text-[var(--platform-text-secondary)]">Deposits & reservations</span>
          </span>
        </Link>
        <Link
          href={platformPath("messages")}
          className="platform-card group flex items-center gap-4 rounded-xl p-4 transition-colors hover:border-[#c4b5fd]"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[rgba(139,92,246,0.12)] text-[var(--platform-accent)]">
            <Bell className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-[var(--platform-text)]">Messages</span>
            <span className="text-xs text-[var(--platform-text-secondary)]">Customer conversations</span>
          </span>
        </Link>
      </div>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Estimated revenue"
            value={formatCurrency(stats.estimatedRevenue)}
            change={`${stats.soldVehicles ?? 0} vehicles sold`}
            changeTone="positive"
            icon={<DollarSign className="size-4" />}
          />
          <StatCard
            label="Available inventory"
            value={stats.availableVehicles}
            change={
              downPaymentsConfirmed > 0
                ? `${activePreOrderCount} active pre-order${activePreOrderCount !== 1 ? "s" : ""} · ${downPaymentsConfirmed} deposit${downPaymentsConfirmed !== 1 ? "s" : ""} confirmed`
                : `${activePreOrderCount} pre-order lead${activePreOrderCount !== 1 ? "s" : ""} · ${stats.totalVehicles} in fleet`
            }
            icon={<Car className="size-4" />}
            onClick={() => router.push(platformPath("inventory"))}
          />
          <StatCard
            label="Pre-order inquiries"
            value={activePreOrderCount || stats.newPreorder || 0}
            change={
              stats.totalPreorderInquiries
                ? `${stats.downPaymentPaidCount ?? 0} down payment${(stats.downPaymentPaidCount ?? 0) !== 1 ? "s" : ""} received · ${stats.totalPreorderInquiries} total submission${stats.totalPreorderInquiries !== 1 ? "s" : ""}`
                : "Customer pre-order requests"
            }
            changeTone={
              (stats.newPreorder ?? 0) > 0
                ? "negative"
                : (stats.downPaymentPaidCount ?? 0) > 0
                  ? "positive"
                  : "neutral"
            }
            icon={<ShoppingBag className="size-4" />}
            onClick={() => router.push(`${platformPath("leads")}?tab=preorder`)}
          />
          <StatCard
            label="Open leads"
            value={stats.totalLeads}
            change="Inquiries needing follow-up — new & pending"
            changeTone={stats.totalLeads > 0 ? "negative" : "neutral"}
            icon={<MessageSquare className="size-4" />}
            onClick={() => router.push(`${platformPath("leads")}?status=new`)}
          />
        </div>
      )}

      {notifications.length > 0 && (
        <div className="platform-card overflow-hidden rounded-xl">
          <div className="flex items-center justify-between border-b border-[var(--platform-border)] px-5 py-4">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-[var(--platform-accent)]" />
              <h2 className="text-sm font-semibold">Needs attention</h2>
            </div>
            <Link
              href={platformPath("notifications")}
              className="text-xs text-[var(--platform-accent)] hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-[var(--platform-border)]">
            {notifications.slice(0, 5).map((n) => (
              <li key={n.id}>
                <Link
                  href={n.link ?? platformPath("leads")}
                  className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-[rgba(76,29,149,0.04)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--platform-text)]">{n.title}</p>
                    <PreorderNotificationPreview notification={n} variant="compact" />
                    <p className="mt-1 text-[11px] text-[var(--platform-text-secondary)]">
                      <PlatformDateTime value={n.createdAt} className="text-[11px]" />
                    </p>
                  </div>
                  {!n.readAt && (
                    <span className="size-2 shrink-0 rounded-full bg-[var(--platform-accent)]" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="platform-card rounded-xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--platform-text)]">
                Inventory availability
              </h2>
              <p className="text-xs text-[var(--platform-text-secondary)]">
                Fleet status and pre-order payment pipeline
              </p>
            </div>
            <TrendingUp className="size-4 text-[var(--platform-accent)]" />
          </div>
          {stats && (
            <InventoryStatusChart
              available={stats.inventoryChartAvailable ?? stats.availableVehicles}
              preOrderPending={stats.inventoryChartPreOrderPending ?? 0}
              preOrderConfirmed={stats.inventoryChartPreOrderConfirmed ?? 0}
              reserved={stats.inventoryChartReserved ?? stats.reservedVehicles ?? 0}
              sold={stats.inventoryChartSold ?? stats.soldVehicles ?? 0}
            />
          )}
          {stats && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--platform-text-secondary)]">
              {[
                {
                  color: "#2563EB",
                  label: "Available",
                  count: stats.inventoryChartAvailable ?? stats.availableVehicles,
                },
                {
                  color: "#F59E0B",
                  label: "Pre-order (awaiting payment)",
                  count: stats.inventoryChartPreOrderPending ?? 0,
                },
                {
                  color: "#22C55E",
                  label: "Pre-order (deposit paid)",
                  count: stats.inventoryChartPreOrderConfirmed ?? 0,
                },
                {
                  color: "#EF4444",
                  label: "Reserved",
                  count: stats.inventoryChartReserved ?? stats.reservedVehicles ?? 0,
                },
                {
                  color: "#737373",
                  label: "Sold",
                  count: stats.inventoryChartSold ?? stats.soldVehicles ?? 0,
                },
              ]
                .filter((item) => item.count > 0)
                .map((item) => (
                  <span key={item.label} className="flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                    <span className="rounded-full bg-[var(--platform-bg-secondary)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--platform-text)]">
                      {item.count}
                    </span>
                  </span>
                ))}
            </div>
          )}
        </div>

        <div className="platform-card rounded-xl p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[var(--platform-text)]">
              Lead pipeline
            </h2>
            <p className="text-xs text-[var(--platform-text-secondary)]">
              Open inquiries by channel
            </p>
          </div>
          {stats && (
            <LeadPipelineChart
              contact={stats.newContact}
              vehicle={stats.newVehicle}
              preorder={stats.newPreorder ?? 0}
              finance={stats.pendingFinance}
              appraisal={stats.pendingAppraisal}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="platform-card overflow-hidden rounded-xl">
          <div className="flex items-center justify-between border-b border-[var(--platform-border)] px-5 py-4">
            <h2 className="text-sm font-semibold">Recent transactions</h2>
            <Link
              href={platformPath("inventory")}
              className="text-xs text-[var(--platform-accent)] hover:underline"
            >
              View inventory
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="platform-table w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-[var(--platform-text-secondary)]">
                  <th className="px-5 py-3 font-medium">Vehicle</th>
                  <th className="px-5 py-3 font-medium">Price</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Listed</th>
                  {canDeleteTransactions && <th className="px-5 py-3 font-medium" />}
                </tr>
              </thead>
              <tbody>
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canDeleteTransactions ? 5 : 4}
                      className="px-5 py-8 text-center text-[var(--platform-text-secondary)]"
                    >
                      No reserved, sold, or confirmed pre-order vehicles yet.
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((v) => (
                    <tr key={v.id} className="border-t border-[var(--platform-border)]">
                      <td className="px-5 py-3">
                        {v.year} {v.make} {v.model}
                      </td>
                      <td className="px-5 py-3 tabular-nums">
                        {formatCurrency(v.price)}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={v.status} />
                      </td>
                      <td className="px-5 py-3 text-xs text-[var(--platform-text-secondary)]">
                        <PlatformDateTime value={v.created_at} />
                      </td>
                      {canDeleteTransactions && (
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            className="platform-btn-ghost text-[var(--platform-danger)]"
                            title="Remove from recent transactions"
                            onClick={() => setDeleteVehicleTarget(v)}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="platform-card overflow-hidden rounded-xl">
          <div className="flex items-center justify-between border-b border-[var(--platform-border)] px-5 py-4">
            <h2 className="text-sm font-semibold">Lead tracking</h2>
            <Link
              href={platformPath("leads")}
              className="text-xs text-[var(--platform-accent)] hover:underline"
            >
              Manage leads
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="platform-table w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-[var(--platform-text-secondary)]">
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-8 text-center text-[var(--platform-text-secondary)]"
                    >
                      No leads captured yet.
                    </td>
                  </tr>
                ) : (
                  recentLeads.map((lead) => (
                    <tr key={`${lead.type}-${lead.id}`} className="border-t border-[var(--platform-border)]">
                      <td className="px-5 py-3">
                        {lead.detailLink ? (
                          <Link href={lead.detailLink} className="hover:opacity-90">
                            <p className="font-medium text-[var(--platform-accent)] hover:underline">
                              {lead.name}
                            </p>
                          </Link>
                        ) : (
                          <Link
                            href={`${platformPath("leads")}?tab=${lead.type}`}
                            className="hover:opacity-90"
                          >
                            <p className="font-medium text-[var(--platform-accent)] hover:underline">
                              {lead.name}
                            </p>
                          </Link>
                        )}
                        <p className="text-xs text-[var(--platform-text-secondary)]">
                          {lead.vehicleTitle ?? lead.summary.slice(0, 48)}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-[var(--platform-text-secondary)]">
                        {leadTypeLabel(lead.type)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={lead.status} />
                          {lead.paymentStatus && (
                            <PaymentStatusBadge status={lead.paymentStatus} />
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-[var(--platform-text-secondary)]">
                        <PlatformDateTime value={lead.createdAt} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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
