"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, RotateCcw, Trash2 } from "lucide-react";
import {
  ConfirmDialog,
  DELETE_CONFIRM_PHRASE,
} from "@/components/platform/confirm-dialog";
import { PageHeader } from "@/components/platform/page-header";
import { PlatformDateTime } from "@/components/platform/platform-datetime";
import { adminLoginPath } from "@/lib/admin/paths";
import { adminErrorMessage, isAdminAuthError, parseAdminResponse } from "@/lib/admin/client";
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
const PAGE_SIZE = 50;

function statusLabel(status: string): string {
  if (status === "pre_order") return "Pre-order";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function TrashPage() {
  const router = useRouter();
  const session = usePlatformSession();
  const { formatPrice } = usePlatformCurrency();
  const canRestore = Boolean(session?.permissions?.trash);
  const canPermanentDelete =
    session?.role === "owner" || session?.role === "super_admin";
  const [items, setItems] = useState<PlatformTrashRow[]>([]);
  const [summary, setSummary] = useState<TrashSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState<TrashEntityType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deletedBy, setDeletedBy] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState("");
  const [toastError, setToastError] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<PlatformTrashRow | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string>("available");
  const [deleteTarget, setDeleteTarget] = useState<PlatformTrashRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkRestoreConfirm, setBulkRestoreConfirm] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkActing, setBulkActing] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (entityType !== "all") params.set("entityType", entityType);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
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
    setSelectedIds(new Set());
    setLoading(false);
  }, [router, entityType, searchQuery, deletedBy, dateFrom, dateTo, page]);

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

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    const visibleIds = items.map((item) => item.id);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  async function restoreItem(id: string, vehicleStatus?: string) {
    setToastError(false);
    setToast("Restoring…");
    setItems((prev) => prev.filter((item) => item.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
    setSummary((prev) =>
      prev
        ? {
            ...prev,
            total: Math.max(0, prev.total - 1),
            byType: (() => {
              const item = items.find((row) => row.id === id);
              if (!item) return prev.byType;
              const next = { ...prev.byType };
              next[item.entity_type] = Math.max(0, (next[item.entity_type] ?? 0) - 1);
              if (next[item.entity_type] === 0) delete next[item.entity_type];
              return next;
            })(),
          }
        : prev
    );
    setRestoreTarget(null);
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    const res = await fetch(`/api/admin/trash/${encodeURIComponent(id)}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vehicleStatus ? { vehicleStatus } : {}),
    });
    const json = await parseAdminResponse(res);
    if (res.ok && json.ok !== false) {
      setToast("Item restored.");
    } else {
      setToastError(true);
      setToast(adminErrorMessage(json, "Could not restore item."));
      void load();
    }
  }

  async function permanentlyDelete(id: string) {
    setToastError(false);
    setToast("Deleting…");
    setItems((prev) => prev.filter((item) => item.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
    setSummary((prev) =>
      prev
        ? {
            ...prev,
            total: Math.max(0, prev.total - 1),
            byType: (() => {
              const item = items.find((row) => row.id === id);
              if (!item) return prev.byType;
              const next = { ...prev.byType };
              next[item.entity_type] = Math.max(0, (next[item.entity_type] ?? 0) - 1);
              if (next[item.entity_type] === 0) delete next[item.entity_type];
              return next;
            })(),
          }
        : prev
    );
    setDeleteTarget(null);
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    const res = await fetch(`/api/admin/trash/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const json = await parseAdminResponse(res);
    if (res.ok && json.ok !== false) {
      setToast("Item permanently deleted.");
    } else {
      setToastError(true);
      setToast(adminErrorMessage(json, "Could not delete item."));
      void load();
    }
  }

  async function applyBulkRestore() {
    const ids = [...selectedIds];
    if (ids.length === 0 || !canRestore) return;
    setBulkActing(true);
    setBulkRestoreConfirm(false);
    setToastError(false);
    setToast(`Restoring ${ids.length} item${ids.length === 1 ? "" : "s"}…`);
    const idSet = new Set(ids);
    setItems((prev) => prev.filter((item) => !idSet.has(item.id)));
    setSelectedIds(new Set());

    const res = await fetch("/api/admin/trash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const json = await parseAdminResponse(res);
    setBulkActing(false);

    const restoredCount = Array.isArray(json.restoredIds)
      ? json.restoredIds.length
      : res.ok && json.ok !== false
        ? ids.length
        : 0;
    const failedCount = Array.isArray(json.failed)
      ? json.failed.length
      : Math.max(0, ids.length - restoredCount);

    if (res.ok && json.ok !== false && failedCount === 0) {
      setToast(`Restored ${ids.length} item${ids.length === 1 ? "" : "s"}.`);
    } else if (restoredCount > 0) {
      setToastError(true);
      setToast(
        `Restored ${restoredCount} of ${ids.length} items. Some restores failed.`
      );
      await load();
    } else {
      setToastError(true);
      setToast(adminErrorMessage(json, "Could not restore items."));
      await load();
    }
  }

  async function applyBulkPermanentDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0 || !canPermanentDelete) return;
    setBulkActing(true);
    setBulkDeleteConfirm(false);
    setToastError(false);
    setToast(
      `Permanently deleting ${ids.length} item${ids.length === 1 ? "" : "s"}…`
    );
    const idSet = new Set(ids);
    setItems((prev) => prev.filter((item) => !idSet.has(item.id)));
    setSelectedIds(new Set());

    const res = await fetch("/api/admin/trash", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const json = await parseAdminResponse(res);
    setBulkActing(false);

    const deletedCount = Array.isArray(json.deletedIds)
      ? json.deletedIds.length
      : res.ok && json.ok !== false
        ? ids.length
        : 0;
    const failedCount = Array.isArray(json.failed)
      ? json.failed.length
      : Math.max(0, ids.length - deletedCount);

    if (res.ok && json.ok !== false && failedCount === 0) {
      setToast(
        `Permanently deleted ${ids.length} item${ids.length === 1 ? "" : "s"}.`
      );
    } else if (deletedCount > 0) {
      setToastError(true);
      setToast(
        `Permanently deleted ${deletedCount} of ${ids.length} items. Some deletions failed.`
      );
      await load();
    } else {
      setToastError(true);
      setToast(adminErrorMessage(json, "Could not delete items."));
      await load();
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

  const allVisibleSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.id));

  return (
    <div className="space-y-6 print:space-y-4">
      <PageHeader
        title="Trash"
        description={
          canPermanentDelete
            ? "Deleted records are kept here so mistakes can be undone. Restore items or permanently remove them."
            : "Deleted records are kept here so mistakes can be undone. Restore items as needed. Permanent delete requires owner or super admin."
        }
        breadcrumb="Platform / Trash"
      />

      {toast && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm print:hidden ${
            toastError
              ? "border-red-500/40 bg-red-500/10 text-red-800"
              : "border-[var(--platform-success)]/30 bg-[rgba(16,185,129,0.08)] text-[var(--platform-success)]"
          }`}
        >
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
          <div className="flex flex-wrap gap-2 text-xs print:hidden">
            <button
              type="button"
              onClick={() => {
                setEntityType("all");
                setPage(1);
              }}
              className={`rounded-full border px-2.5 py-1 ${
                entityType === "all"
                  ? "border-[var(--platform-accent)] bg-[var(--platform-accent)]/10 text-[var(--platform-text)]"
                  : "border-[var(--platform-border)] bg-[var(--platform-bg-secondary)] text-[var(--platform-text-secondary)]"
              }`}
            >
              All:{" "}
              <span className="font-semibold text-[var(--platform-text)]">
                {summary?.total ?? total}
              </span>
            </button>
            {typeCounts.map((row) => (
              <button
                type="button"
                key={row.type}
                onClick={() => {
                  setEntityType(row.type);
                  setPage(1);
                }}
                className={`rounded-full border px-2.5 py-1 ${
                  entityType === row.type
                    ? "border-[var(--platform-accent)] bg-[var(--platform-accent)]/10 text-[var(--platform-text)]"
                    : "border-[var(--platform-border)] bg-[var(--platform-bg-secondary)] text-[var(--platform-text-secondary)]"
                }`}
              >
                {row.label}:{" "}
                <span className="font-semibold text-[var(--platform-text)]">{row.count}</span>
              </button>
            ))}
          </div>
        )}
        {typeCounts.length > 0 && (
          <div className="hidden flex-wrap gap-2 text-xs print:flex">
            {typeCounts.map((row) => (
              <span
                key={row.type}
                className="rounded-full border border-[var(--platform-border)] bg-[var(--platform-bg-secondary)] px-2.5 py-1 text-[var(--platform-text-secondary)]"
              >
                {row.label}:{" "}
                <span className="font-semibold text-[var(--platform-text)]">{row.count}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="platform-card rounded-xl p-4 print:hidden">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block text-xs text-[var(--platform-text-secondary)] sm:col-span-2 lg:col-span-1">
            Search
            <input
              className="platform-input mt-1 w-full"
              placeholder="Name, make, model, VIN, id…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="block text-xs text-[var(--platform-text-secondary)]">
            Type
            <select
              className="platform-input mt-1 w-full"
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value as TrashEntityType | "all");
                setPage(1);
              }}
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
              onChange={(e) => {
                setDeletedBy(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="block text-xs text-[var(--platform-text-secondary)]">
            From date
            <input
              type="date"
              className="platform-input mt-1 w-full"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="block text-xs text-[var(--platform-text-secondary)]">
            To date
            <input
              type="date"
              className="platform-input mt-1 w-full"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-[var(--platform-text-secondary)]">
          {total} item{total !== 1 ? "s" : ""} matching filters
          {totalPages > 1 ? ` · Page ${page} of ${totalPages}` : ""}
          {entityType === "all" && (summary?.total ?? 0) > PAGE_SIZE
            ? " · Newest first — use Type or Search to find older items"
            : ""}
        </p>
      </div>

      <div className="platform-card overflow-hidden rounded-xl">
        {canRestore && selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--platform-border)] bg-[var(--platform-bg-secondary)] px-4 py-3 print:hidden">
            <p className="text-sm text-[var(--platform-text)]">
              <span className="font-medium">{selectedIds.size}</span> selected
            </p>
            <button
              type="button"
              disabled={bulkActing}
              onClick={() => setBulkRestoreConfirm(true)}
              className="platform-btn-ghost text-xs disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" />
              Restore
            </button>
            {canPermanentDelete && (
              <button
                type="button"
                disabled={bulkActing}
                onClick={() => setBulkDeleteConfirm(true)}
                className="platform-btn-ghost text-xs text-[var(--platform-danger)] disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                Delete forever
              </button>
            )}
            <button
              type="button"
              disabled={bulkActing}
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-[var(--platform-text-secondary)] hover:text-[var(--platform-text)] disabled:opacity-50"
            >
              Clear selection
            </button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="platform-table w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-[var(--platform-text-secondary)]">
                {canRestore && (
                  <th className="px-3 py-3 font-medium print:hidden">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      disabled={items.length === 0 || bulkActing}
                      className="size-4 rounded border-[var(--platform-border)]"
                      aria-label="Select all visible trash items"
                    />
                  </th>
                )}
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
                    colSpan={canRestore ? 5 : 4}
                    className="px-4 py-10 text-center text-[var(--platform-text-secondary)]"
                  >
                    {(summary?.total ?? 0) === 0 &&
                    !searchQuery.trim() &&
                    !deletedBy.trim() &&
                    !dateFrom &&
                    !dateTo &&
                    entityType === "all"
                      ? "Trash is empty."
                      : "No trash items match these filters."}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-[var(--platform-border)]">
                    {canRestore && (
                      <td className="px-3 py-3 align-middle print:hidden">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelected(item.id)}
                          disabled={bulkActing}
                          className="size-4 rounded border-[var(--platform-border)]"
                          aria-label={`Select ${item.entity_label}`}
                        />
                      </td>
                    )}
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
                        {canRestore && (
                          <button
                            type="button"
                            className="platform-btn-ghost text-xs"
                            disabled={bulkActing}
                            onClick={() => setRestoreTarget(item)}
                          >
                            <RotateCcw className="size-3.5" />
                            Restore
                          </button>
                        )}
                        {canPermanentDelete && (
                          <button
                            type="button"
                            className="platform-btn-ghost text-xs text-[var(--platform-danger)]"
                            disabled={bulkActing}
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--platform-border)] px-4 py-3 print:hidden">
            <p className="text-xs text-[var(--platform-text-secondary)]">
              Page {page} of {totalPages} ({total} total)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || bulkActing}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="platform-btn-ghost text-xs disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || bulkActing}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="platform-btn-ghost text-xs disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
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
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={async () => {
          if (deleteTarget) await permanentlyDelete(deleteTarget.id);
        }}
      />

      <ConfirmDialog
        open={bulkRestoreConfirm}
        onOpenChange={(open) => {
          if (!open && !bulkActing) setBulkRestoreConfirm(false);
        }}
        title="Restore selected items?"
        description={`Restore ${selectedIds.size} item${selectedIds.size === 1 ? "" : "s"} from trash? Soft-deleted records will return to their previous state (vehicles keep their prior inventory status).`}
        confirmLabel="Restore"
        onConfirm={applyBulkRestore}
      />

      <ConfirmDialog
        open={bulkDeleteConfirm}
        onOpenChange={(open) => {
          if (!open && !bulkActing) setBulkDeleteConfirm(false);
        }}
        title="Permanently delete selected items?"
        description={`Permanently delete ${selectedIds.size} item${selectedIds.size === 1 ? "" : "s"} from the database? This cannot be undone.`}
        confirmLabel="Delete permanently"
        destructive
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={applyBulkPermanentDelete}
      />
    </div>
  );
}
