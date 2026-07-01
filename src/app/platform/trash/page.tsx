"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, RotateCcw, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/platform/confirm-dialog";
import { PageHeader } from "@/components/platform/page-header";
import { PlatformDateTime } from "@/components/platform/platform-datetime";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { usePlatformCurrency } from "@/context/platform-currency-context";
import { usePlatformSession } from "@/components/platform/platform-shell";
import {
  TRASH_ENTITY_LABELS,
  TRASH_ENTITY_TYPES,
  type PlatformTrashRow,
  type TrashEntityType,
} from "@/lib/platform/trash-types";

type TrashSummary = {
  total: number;
  byType: Partial<Record<TrashEntityType, number>>;
  totalSalesValue: number;
  totalOrdersValue: number;
  totalVehicleValue: number;
};

const VEHICLE_STATUSES = ["available", "pre_order", "sold", "reserved"] as const;

function statusLabel(status: string): string {
  if (status === "pre_order") return "Pre-order";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function TrashPage() {
  const router = useRouter();
  const session = usePlatformSession();
  const { formatPrice } = usePlatformCurrency();
  const isOwner = session?.role === "owner";
  const [items, setItems] = useState<PlatformTrashRow[]>([]);
  const [summary, setSummary] = useState<TrashSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState<TrashEntityType | "all">("all");
  const [deletedBy, setDeletedBy] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [toast, setToast] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<PlatformTrashRow | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string>("available");
  const [deleteTarget, setDeleteTarget] = useState<PlatformTrashRow | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (entityType !== "all") params.set("entityType", entityType);
    if (deletedBy.trim()) params.set("deletedBy", deletedBy.trim());
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    const res = await fetch(`/api/admin/trash?${params.toString()}`);
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    if (res.status === 403) {
      router.push("/platform/dashboard");
      return;
    }

    const json = await res.json();
    setItems(json.items ?? []);
    setTotal(json.total ?? 0);
    setSummary(json.summary ?? null);
    setLoading(false);
  }, [router, entityType, deletedBy, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const defaultRestoreStatus = useMemo(() => {
    if (!restoreTarget || restoreTarget.entity_type !== "vehicle") return "available";
    const snapshot = restoreTarget.snapshot ?? {};
    const previous = String(snapshot.status ?? "available");
    return VEHICLE_STATUSES.includes(previous as (typeof VEHICLE_STATUSES)[number])
      ? previous
      : "available";
  }, [restoreTarget]);

  useEffect(() => {
    if (restoreTarget?.entity_type === "vehicle") {
      setRestoreStatus(defaultRestoreStatus);
    }
  }, [restoreTarget, defaultRestoreStatus]);

  async function restoreItem(id: string, vehicleStatus?: string) {
    const res = await fetch(`/api/admin/trash/${encodeURIComponent(id)}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vehicleStatus ? { vehicleStatus } : {}),
    });
    const json = await res.json();
    if (res.ok) {
      setToast("Item restored.");
      load();
    } else {
      setToast(json.message ?? "Could not restore item.");
    }
  }

  async function permanentlyDelete(id: string) {
    const res = await fetch(`/api/admin/trash/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (res.ok) {
      setToast("Item permanently deleted.");
      load();
    } else {
      setToast(json.message ?? "Could not delete item.");
    }
  }

  function handlePrintReport() {
    window.print();
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading trash…</p>;
  }

  const typeCounts = TRASH_ENTITY_TYPES.map((type) => ({
    type,
    label: TRASH_ENTITY_LABELS[type],
    count: summary?.byType[type] ?? 0,
  })).filter((row) => row.count > 0);

  return (
    <div className="space-y-6 print:space-y-4">
      <PageHeader
        title="Trash"
        description="Deleted records are kept here so mistakes can be undone. Restore items or permanently remove them (owner only)."
        breadcrumb="Platform / Trash"
      />

      {toast && (
        <div className="rounded-lg border border-[var(--platform-success)]/30 bg-[rgba(16,185,129,0.08)] px-4 py-3 text-sm text-[var(--platform-success)] print:hidden">
          {toast}
        </div>
      )}

      <section className="space-y-4 print:break-inside-avoid" aria-label="Trash summary report">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--platform-text)]">Trash report</h2>
          <button
            type="button"
            onClick={handlePrintReport}
            className="platform-btn-ghost text-xs print:hidden"
          >
            <Printer className="size-3.5" />
            Print report
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="platform-card rounded-xl p-4">
            <p className="text-xs text-[var(--platform-text-secondary)]">Total in trash</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--platform-text)]">
              {summary?.total ?? total}
            </p>
          </div>
          <div className="platform-card rounded-xl p-4">
            <p className="text-xs text-[var(--platform-text-secondary)]">Vehicles</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--platform-text)]">
              {summary?.byType.vehicle ?? 0}
            </p>
            {(summary?.totalVehicleValue ?? 0) > 0 && (
              <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
                Listed value {formatPrice(summary?.totalVehicleValue ?? 0)}
              </p>
            )}
          </div>
          <div className="platform-card rounded-xl p-4">
            <p className="text-xs text-[var(--platform-text-secondary)]">Sales</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--platform-text)]">
              {summary?.byType.sale ?? 0}
            </p>
            {(summary?.totalSalesValue ?? 0) > 0 && (
              <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
                Value {formatPrice(summary?.totalSalesValue ?? 0)}
              </p>
            )}
          </div>
          <div className="platform-card rounded-xl p-4">
            <p className="text-xs text-[var(--platform-text-secondary)]">Orders & leads</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--platform-text)]">
              {(summary?.byType.order ?? 0) +
                (summary?.byType.preorder ?? 0) +
                (summary?.byType.lead_contact ?? 0) +
                (summary?.byType.lead_finance ?? 0) +
                (summary?.byType.lead_appraisal ?? 0) +
                (summary?.byType.lead_vehicle ?? 0)}
            </p>
            {(summary?.totalOrdersValue ?? 0) > 0 && (
              <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
                Order value {formatPrice(summary?.totalOrdersValue ?? 0)}
              </p>
            )}
          </div>
        </div>

        {typeCounts.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {typeCounts.map((row) => (
              <span
                key={row.type}
                className="rounded-full border border-[var(--platform-border)] bg-[var(--platform-bg-secondary)] px-2.5 py-1 text-[var(--platform-text-secondary)]"
              >
                {row.label}: <span className="font-semibold text-[var(--platform-text)]">{row.count}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="platform-card rounded-xl p-4 print:hidden">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs text-[var(--platform-text-secondary)]">
            Type
            <select
              className="platform-input mt-1 w-full"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as TrashEntityType | "all")}
            >
              <option value="all">All types</option>
              {TRASH_ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TRASH_ENTITY_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-[var(--platform-text-secondary)]">
            Deleted by
            <input
              className="platform-input mt-1 w-full"
              placeholder="Name or email"
              value={deletedBy}
              onChange={(e) => setDeletedBy(e.target.value)}
            />
          </label>
          <label className="block text-xs text-[var(--platform-text-secondary)]">
            From date
            <input
              type="date"
              className="platform-input mt-1 w-full"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="block text-xs text-[var(--platform-text-secondary)]">
            To date
            <input
              type="date"
              className="platform-input mt-1 w-full"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-[var(--platform-text-secondary)]">
          {total} item{total !== 1 ? "s" : ""} matching filters
        </p>
      </div>

      <div className="platform-card overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="platform-table w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-[var(--platform-text-secondary)]">
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Activity record</th>
                <th className="px-4 py-3 font-medium text-right print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-[var(--platform-text-secondary)]"
                  >
                    Trash is empty.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-[var(--platform-border)]">
                    <td className="px-4 py-3 text-[var(--platform-text-secondary)]">
                      {TRASH_ENTITY_LABELS[item.entity_type] ?? item.entity_type}
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--platform-text)]">
                      {item.entity_label}
                      {item.entity_type === "vehicle" &&
                        typeof item.snapshot?.status === "string" &&
                        item.snapshot.status && (
                        <p className="mt-0.5 text-xs font-normal text-[var(--platform-text-secondary)]">
                          Was {statusLabel(item.snapshot.status)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--platform-text-secondary)]">
                      <p>
                        Deleted by{" "}
                        <span className="font-medium text-[var(--platform-text)]">
                          {item.deleted_by_name ?? item.deleted_by_email ?? "Unknown"}
                        </span>
                      </p>
                      <p className="mt-0.5">
                        on <PlatformDateTime value={item.deleted_at} />
                      </p>
                    </td>
                    <td className="px-4 py-3 print:hidden">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="platform-btn-ghost text-xs"
                          onClick={() => setRestoreTarget(item)}
                        >
                          <RotateCcw className="size-3.5" />
                          Restore
                        </button>
                        {isOwner && (
                          <button
                            type="button"
                            className="platform-btn-ghost text-xs text-[var(--platform-danger)]"
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 className="size-3.5" />
                            Delete forever
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(restoreTarget)}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
        title="Restore item?"
        description={
          restoreTarget?.entity_type === "vehicle"
            ? `"${restoreTarget.entity_label}" will rejoin inventory. Choose the status to apply on restore.`
            : `"${restoreTarget?.entity_label ?? "This item"}" will be restored to its previous state and removed from trash.`
        }
        confirmLabel="Restore"
        onConfirm={async () => {
          if (!restoreTarget) return;
          const status =
            restoreTarget.entity_type === "vehicle" ? restoreStatus : undefined;
          await restoreItem(restoreTarget.id, status);
        }}
      >
        {restoreTarget?.entity_type === "vehicle" && (
          <label className="block text-left text-xs text-[var(--platform-text-secondary)]">
            Restore as
            <select
              className="platform-input mt-1 w-full"
              value={restoreStatus}
              onChange={(e) => setRestoreStatus(e.target.value)}
            >
              {VEHICLE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                  {status === defaultRestoreStatus ? " (previous)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Permanently delete?"
        description={`"${deleteTarget?.entity_label ?? "This item"}" will be permanently removed from the database. This cannot be undone.`}
        confirmLabel="Delete permanently"
        destructive
        onConfirm={async () => {
          if (deleteTarget) await permanentlyDelete(deleteTarget.id);
        }}
      />
    </div>
  );
}
