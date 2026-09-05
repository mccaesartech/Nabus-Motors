"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Download, History, Plus, Search, X, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import {
  ConfirmDialog,
  DELETE_CONFIRM_PHRASE,
} from "@/components/platform/confirm-dialog";
import { ApprovalStatusBadge } from "@/components/platform/status-badge";
import { VehicleStatusControl } from "@/components/platform/vehicle-status-control";
import { VEHICLE_STATUS_LABELS, normalizeStockQuantity, type VehicleInput } from "@/lib/admin/vehicle-fields";
import { cn } from "@/lib/utils";
import {
  ActiveFiltersSummary,
  CategoryBadges,
  mergeFilters,
} from "@/components/admin/category-badges";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { VehicleColorSwatch } from "@/components/shared/vehicle-color-swatch";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { platformPath } from "@/lib/platform/paths";
import {
  applyInventoryFilters,
  buildFilterChips,
  EMPTY_INVENTORY_FILTERS,
  type InventoryFilters,
} from "@/lib/admin/vehicle-filters";
import { formatAdminCurrencyPreviews } from "@/lib/currency";
import { usePlatformCurrency } from "@/context/platform-currency-context";
import { primaryPhotoFor } from "@/lib/data/vehicle-images";
import { resolveExteriorColor } from "@/lib/vehicles/vehicle-colors";
import type { BodyType } from "@/lib/types";
import type { DbVehicle } from "@/lib/platform/types";
import { PlatformDateTime } from "@/components/platform/platform-datetime";
import { downloadCsv, exportVehiclesCsv } from "@/lib/platform/data";
import { usePlatformSession } from "@/components/platform/platform-shell";
import { canExportInventory } from "@/lib/platform/permissions";
import { adminErrorMessage, parseAdminResponse } from "@/lib/admin/client";
import {
  VirtualTableBody,
  VirtualTableScroll,
} from "@/components/platform/virtual-table-body";
import {
  hasPendingEdits,
  isPubliclyListed,
  isRejectedEditPending,
  mergeVehicleWithPending,
} from "@/lib/admin/vehicle-pending-changes";
import { buildVehiclePublishSummary } from "@/lib/admin/vehicle-publish-gates";
import { VehiclePublishConfirmDialog } from "@/components/platform/vehicle-publish-confirm-dialog";
import type { VehiclePublishSummary } from "@/lib/admin/vehicle-publish-gates";
import {
  availableCountForVehicle,
  buildAvailableStockCounts,
  listLowStockGroups,
  modelStockLevel,
  shouldHighlightVehicleStock,
} from "@/lib/vehicles/low-stock";

type ApprovalFilter = "all" | "pending_approval" | "approved" | "rejected";
type ListingTab = "all" | "available" | "pre_order";

type InventoryStockMeta = {
  availableCount: number;
  lowStockThreshold: number;
  notifyLowStockEnabled: boolean;
  fleetLowStock: boolean;
};

export default function InventoryPage() {
  const router = useRouter();
  const session = usePlatformSession();
  const canEdit = session?.permissions.inventory_edit ?? false;
  const canApprove = session?.permissions.inventory_approve ?? false;
  const canExport = session ? canExportInventory(session.role) : false;
  const isManager = session?.role === "manager";
  const { formatVehicleListPrice } = usePlatformCurrency();
  const searchParams = useSearchParams();
  const [vehicles, setVehicles] = useState<DbVehicle[]>([]);
  const [stockMeta, setStockMeta] = useState<InventoryStockMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [stockFilter, setStockFilter] = useState<"all" | "low">(
    () => (searchParams.get("stock") === "low" ? "low" : "all")
  );
  const [filters, setFilters] = useState<InventoryFilters>(EMPTY_INVENTORY_FILTERS);
  const [toast, setToast] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [bulkTrashConfirm, setBulkTrashConfirm] = useState(false);
  const [bulkActing, setBulkActing] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{
    id: string;
    name: string;
    isEdit: boolean;
  } | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [approveTarget, setApproveTarget] = useState<{
    id: string;
    summary: VehiclePublishSummary;
  } | null>(null);
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>(() => {
    const param = searchParams.get("approval");
    if (param === "pending") return "pending_approval";
    if (param === "pending_approval" || param === "approved" || param === "rejected") {
      return param;
    }
    return "all";
  });
  const [listingTab, setListingTab] = useState<ListingTab>(() => {
    const tab = searchParams.get("listing");
    if (tab === "available" || tab === "pre_order") return tab;
    return "all";
  });
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [statusConfirmTarget, setStatusConfirmTarget] = useState<{
    id: string;
    name: string;
    status: string;
    bulk?: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/vehicles");
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = await res.json();
    setVehicles(json.vehicles ?? []);
    if (json.stock) {
      setStockMeta({
        availableCount: Number(json.stock.availableCount) || 0,
        lowStockThreshold: Number(json.stock.lowStockThreshold) || 5,
        notifyLowStockEnabled: Boolean(json.stock.notifyLowStockEnabled),
        fleetLowStock: Boolean(json.stock.fleetLowStock),
      });
    } else {
      setStockMeta(null);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) setSearch(q);
    setStockFilter(searchParams.get("stock") === "low" ? "low" : "all");
    const param = searchParams.get("approval");
    if (param === "pending") setApprovalFilter("pending_approval");
    else if (
      param === "pending_approval" ||
      param === "approved" ||
      param === "rejected"
    ) {
      setApprovalFilter(param);
    }
  }, [searchParams]);

  const setStockFilterAndUrl = useCallback(
    (next: "all" | "low") => {
      setStockFilter(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "low") params.set("stock", "low");
      else params.delete("stock");
      const qs = params.toString();
      router.replace(qs ? `${platformPath("inventory")}?${qs}` : platformPath("inventory"));
    },
    [router, searchParams]
  );
  const availableStockCounts = useMemo(
    () => buildAvailableStockCounts(vehicles),
    [vehicles]
  );

  const lowStockGroups = useMemo(
    () => listLowStockGroups(vehicles, availableStockCounts),
    [vehicles, availableStockCounts]
  );
  const pendingCount = useMemo(
    () => vehicles.filter((v) => v.approval_status === "pending_approval").length,
    [vehicles]
  );

  const rejectedCount = useMemo(
    () => vehicles.filter((v) => v.approval_status === "rejected").length,
    [vehicles]
  );

  const listingCounts = useMemo(
    () => ({
      all: vehicles.length,
      available: vehicles.filter((v) => v.status === "available").length,
      pre_order: vehicles.filter((v) => v.status === "pre_order").length,
    }),
    [vehicles]
  );

  const filtered = useMemo(() => {
    let list = applyInventoryFilters(vehicles, filters, search);
    if (listingTab === "available" && filters.fulfillmentMode === "all") {
      list = list.filter((v) => v.status === "available");
    } else if (listingTab === "pre_order" && filters.fulfillmentMode === "all") {
      list = list.filter((v) => v.status === "pre_order");
    }
    if (approvalFilter !== "all") {
      list = list.filter((v) => (v.approval_status ?? "approved") === approvalFilter);
    }
    if (stockFilter === "low") {
      list = list.filter((v) => shouldHighlightVehicleStock(v, availableStockCounts));
    }
    return [...list].sort((a, b) => {
      const makeCmp = a.make.localeCompare(b.make, undefined, { sensitivity: "base" });
      if (makeCmp !== 0) return makeCmp;
      return b.year - a.year;
    });
  }, [vehicles, filters, search, approvalFilter, listingTab, stockFilter, availableStockCounts]);

  const chips = useMemo(() => buildFilterChips(vehicles, filters), [vehicles, filters]);

  const activeChipId = useMemo(() => {
    const match = chips.find(
      (chip) =>
        chip.id !== "all" &&
        Object.entries(chip.filters).every(
          ([key, value]) => filters[key as keyof InventoryFilters] === value
        ) &&
        Object.entries(filters).every(([key, value]) => {
          const filterKey = key as keyof InventoryFilters;
          if (value === EMPTY_INVENTORY_FILTERS[filterKey]) return true;
          return chip.filters[filterKey] === value;
        })
    );
    return match?.id ?? (JSON.stringify(filters) === JSON.stringify(EMPTY_INVENTORY_FILTERS) ? "all" : null);
  }, [chips, filters]);

  const hasDropdownFilters =
    filters.bodyType !== "all" ||
    filters.status !== "all" ||
    filters.transmission !== "all" ||
    filters.fuelType !== "all" ||
    filters.featured !== "all" ||
    filters.brandOrigin !== "all" ||
    filters.fulfillmentMode !== "all" ||
    filters.availableLocally !== "all" ||
    filters.financingAvailable !== "all";

  async function updateVehicleStatus(
    id: string,
    status: string,
    successMessage?: string
  ): Promise<boolean> {
    setActingOnId(id);
    const res = await fetch("/api/admin/vehicles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const json = await parseAdminResponse(res);
    setActingOnId(null);
    if (!res.ok || !json.ok) {
      if (successMessage !== undefined) {
        setToast(adminErrorMessage(json, "Could not update vehicle status."));
      }
      return false;
    }
    if (successMessage !== undefined) {
      let extra = "";
      if (status === "sold") {
        if (json.unitDecremented) {
          const remaining = Number(json.stock_quantity);
          extra =
            Number.isFinite(remaining)
              ? ` One unit sold — ${remaining} still in stock on this listing.`
              : " One unit sold — quantity reduced.";
        } else if (json.autoPreOrder) {
          extra = " Listing moved to pre-order — last unit of this model.";
        }
      }
      setToast(`${successMessage}${extra}`);
    }
    return true;
  }

  async function updateVehicleQuantity(
    id: string,
    name: string,
    quantity: number
  ): Promise<boolean> {
    const stock_quantity = normalizeStockQuantity(quantity, 0);
    setActingOnId(id);
    const res = await fetch("/api/admin/vehicles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, stock_quantity }),
    });
    const json = await parseAdminResponse(res);
    setActingOnId(null);
    if (!res.ok || !json.ok) {
      setToast(adminErrorMessage(json, "Could not update units in stock."));
      return false;
    }
    if (json.pendingApproval) {
      setToast(`${name}: units change submitted for approval.`);
    } else {
      setToast(`${name}: units in stock set to ${stock_quantity}.`);
    }
    return true;
  }

  function requestStatusChange(
    id: string,
    name: string,
    status: string,
    currentStatus: string
  ) {
    if (status === currentStatus) return;
    if (status === "sold") {
      setStatusConfirmTarget({ id, name, status });
      return;
    }
    const label = VEHICLE_STATUS_LABELS[status] ?? status;
    void updateVehicleStatus(id, status, `${name} marked as ${label}.`).then((ok) => {
      if (ok) void load();
    });
  }

  async function applyBulkStatus(status: string) {
    if (!status || selectedIds.size === 0) return;
    if (status === "sold") {
      setStatusConfirmTarget({
        id: "",
        name: `${selectedIds.size} vehicle${selectedIds.size === 1 ? "" : "s"}`,
        status,
        bulk: true,
      });
      setBulkStatus("");
      return;
    }
    const ids = [...selectedIds];
    let failed = 0;
    for (const id of ids) {
      const ok = await updateVehicleStatus(id, status);
      if (!ok) failed++;
    }
    await load();
    if (failed === 0) {
      setSelectedIds(new Set());
      setBulkStatus("");
      setToast(
        `Updated ${ids.length} vehicle${ids.length === 1 ? "" : "s"} to ${VEHICLE_STATUS_LABELS[status] ?? status}.`
      );
    } else {
      setToast(`Updated ${ids.length - failed} of ${ids.length} vehicles. Some updates failed.`);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    const visibleIds = filtered.map((v) => v.id);
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

  async function deleteVehicle(id: string, _name: string) {
    setActingOnId(id);
    setDeleteTarget(null);
    setToast("Moving vehicle to trash…");
    setVehicles((prev) => prev.filter((v) => v.id !== id));
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    const res = await fetch(`/api/admin/vehicles?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const json = await parseAdminResponse(res);
    setActingOnId(null);
    if (res.ok && json.ok) {
      setToast("Vehicle moved to trash. Restore it from Platform → Trash if needed.");
      void load();
    } else {
      setToast(adminErrorMessage(json, "Could not move vehicle to trash."));
      void load();
    }
  }

  async function applyBulkTrash() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkActing(true);
    setBulkTrashConfirm(false);
    setToast(
      `Moving ${ids.length} vehicle${ids.length === 1 ? "" : "s"} to trash…`
    );
    const idSet = new Set(ids);
    setVehicles((prev) => prev.filter((v) => !idSet.has(v.id)));
    setSelectedIds(new Set());

    const res = await fetch("/api/admin/vehicles", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const json = await parseAdminResponse(res);
    setBulkActing(false);
    await load();

    const deletedCount = Array.isArray(json.deletedIds)
      ? json.deletedIds.length
      : res.ok && json.ok
        ? ids.length
        : 0;
    const failedCount = Array.isArray(json.failed)
      ? json.failed.length
      : Math.max(0, ids.length - deletedCount);

    if (res.ok && json.ok && failedCount === 0) {
      setToast(
        `Moved ${ids.length} vehicle${ids.length === 1 ? "" : "s"} to trash. Restore from Platform → Trash if needed.`
      );
    } else if (deletedCount > 0) {
      setToast(
        `Moved ${deletedCount} of ${ids.length} vehicles to trash. Some deletions failed.`
      );
    } else {
      setToast(adminErrorMessage(json, "Could not move vehicles to trash."));
    }
  }

  async function reviewVehicle(
    id: string,
    action: "approve" | "reject" | "dismiss",
    note?: string,
    isEditRejection?: boolean
  ) {
    setActingOnId(id);
    const res = await fetch("/api/admin/vehicles/approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        action,
        note: note?.trim() || undefined,
        ...(action === "approve" ? { publishConfirmed: true } : {}),
      }),
    });
    const json = await parseAdminResponse(res);
    setActingOnId(null);
    if (!res.ok || !json.ok) {
      setToast(adminErrorMessage(json, "Could not update approval status."));
      return;
    }
    setRejectTarget(null);
    setRejectNote("");
    setApproveTarget(null);
    setToast(
      action === "approve"
        ? "Vehicle approved and published."
        : action === "dismiss"
          ? "Rejected edits dismissed. The live listing is unchanged."
          : isEditRejection
            ? "Pending edits rejected. The live listing is unchanged."
            : "Vehicle rejected."
    );
    load();
  }

  function handleExport() {
    downloadCsv(
      `true-goshen-inventory-${new Date().toISOString().slice(0, 10)}.csv`,
      exportVehiclesCsv(filtered)
    );
  }

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading inventory…</p>;
  }

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <PageHeader
        title="Vehicles"
        description={
          canEdit
            ? isManager
              ? "Add vehicles for owner review. Approved listings appear on the public site."
              : "Manage stock, pricing, availability, and merchandising across your showroom."
            : "Browse stock, pricing, availability, and merchandising across your showroom."
        }
        breadcrumb="Inventory"
        actions={
          <>
            <Link href={platformPath("inventory/ai-usage")} className="platform-btn-ghost">
              <History className="size-4" />
              AI usage
            </Link>
            {canExport ? (
              <button type="button" onClick={handleExport} className="platform-btn-ghost">
                <Download className="size-4" />
                Export CSV
              </button>
            ) : null}
            {canEdit && (
              <Link href={platformPath("inventory/new")} className="platform-btn-primary">
                <Plus className="size-4" />
                Add vehicle
              </Link>
            )}
          </>
        }
      />

      {toast && (
        <div className="rounded-lg border border-[var(--platform-success)]/30 bg-[rgba(16,185,129,0.08)] px-4 py-3 text-sm text-[var(--platform-success)]">
          {toast}
        </div>
      )}

      {(stockMeta?.fleetLowStock || lowStockGroups.length > 0) && (
        <div
          className={cn(
            "flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3",
            stockMeta?.fleetLowStock
              ? "border-red-300/70 bg-red-50"
              : "border-amber-300/70 bg-amber-50"
          )}
          role="status"
        >
          <div className="flex min-w-0 flex-1 gap-3">
            <AlertTriangle
              className={cn(
                "mt-0.5 size-5 shrink-0",
                stockMeta?.fleetLowStock ? "text-red-600" : "text-amber-600"
              )}
              aria-hidden
            />
            <div className="min-w-0 space-y-1">
              <p
                className={cn(
                  "text-sm font-semibold",
                  stockMeta?.fleetLowStock ? "text-red-800" : "text-amber-900"
                )}
              >
                {stockMeta?.fleetLowStock ? "Low Stock warning" : "Model low stock"}
              </p>
              <p
                className={cn(
                  "text-sm",
                  stockMeta?.fleetLowStock ? "text-red-700" : "text-amber-800"
                )}
              >
                {stockMeta?.fleetLowStock
                  ? `Only ${stockMeta.availableCount} available vehicle${
                      stockMeta.availableCount === 1 ? "" : "s"
                    } (threshold ${stockMeta.lowStockThreshold}).`
                  : null}
                {lowStockGroups.length > 0
                  ? `${stockMeta?.fleetLowStock ? " " : ""}${lowStockGroups.length} make/model/year group${
                      lowStockGroups.length === 1 ? "" : "s"
                    } at ≤1 available unit.`
                  : null}{" "}
                Consider adding inventory, importing more units, or setting Pre-order / Available in
                Ghana.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStockFilterAndUrl("low")}
              className="platform-btn-ghost text-xs"
            >
              Show low stock
            </button>
            {canEdit && (
              <Link href={platformPath("inventory/new")} className="platform-btn-primary text-xs">
                <Plus className="size-3.5" />
                Add / import vehicle
              </Link>
            )}
          </div>
        </div>
      )}

      {stockFilter === "low" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-900">
          <span>
            Filtering to low-stock models ({filtered.length} listing
            {filtered.length === 1 ? "" : "s"})
          </span>
          <button
            type="button"
            onClick={() => setStockFilterAndUrl("all")}
            className="text-xs font-medium text-amber-800 underline-offset-2 hover:underline"
          >
            Clear stock filter
          </button>
        </div>
      )}

      {canApprove && rejectedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--platform-error)]/30 bg-[rgba(239,68,68,0.08)] px-4 py-3">
          <p className="text-sm text-[var(--platform-text)]">
            <span className="font-medium">{rejectedCount}</span>{" "}
            {rejectedCount === 1 ? "vehicle has" : "vehicles have"} rejected edits or submissions
            awaiting your decision.
          </p>
          <button
            type="button"
            onClick={() => setApprovalFilter("rejected")}
            className="platform-btn-ghost text-xs"
          >
            Review rejected
          </button>
        </div>
      )}

      {canApprove && pendingCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--platform-accent)]/30 bg-[rgba(59,130,246,0.08)] px-4 py-3">
          <p className="text-sm text-[var(--platform-text)]">
            <span className="font-medium">{pendingCount}</span>{" "}
            {pendingCount === 1 ? "vehicle needs" : "vehicles need"} your approval before going live.
          </p>
          <button
            type="button"
            onClick={() => setApprovalFilter("pending_approval")}
            className="platform-btn-primary text-xs"
          >
            Review pending
          </button>
        </div>
      )}

      <div className="platform-card rounded-xl p-1">
        <div className="flex flex-wrap gap-1">
          {(
            [
              { id: "all" as const, label: "All listings" },
              { id: "available" as const, label: "Available — buy now" },
              { id: "pre_order" as const, label: "Pre-order listings" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-active={listingTab === tab.id}
              onClick={() => {
                setListingTab(tab.id);
                if (tab.id === "all") {
                  setFilters((f) => ({
                    ...f,
                    status: "all",
                    fulfillmentMode: "all",
                  }));
                } else if (tab.id === "available") {
                  setFilters((f) => ({
                    ...f,
                    status: "available",
                    fulfillmentMode: "all",
                  }));
                } else {
                  setFilters((f) => ({
                    ...f,
                    status: "all",
                    fulfillmentMode: "pre_order_only",
                  }));
                }
              }}
              className="platform-filter-chip flex-1 justify-center sm:flex-none"
            >
              <span>{tab.label}</span>
              <span className="rounded-full bg-[var(--platform-bg-secondary)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--platform-text-secondary)]">
                {listingCounts[tab.id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="platform-card space-y-3 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]">
            Quick filters
          </p>
          {(activeChipId || hasDropdownFilters) && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_INVENTORY_FILTERS)}
              className="text-xs font-medium text-[var(--platform-accent)] hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              data-active={activeChipId === chip.id}
              onClick={() => setFilters(mergeFilters(EMPTY_INVENTORY_FILTERS, chip.filters))}
              className="platform-filter-chip"
            >
              <span>{chip.label}</span>
              <span className="rounded-full bg-[var(--platform-bg-secondary)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--platform-text-secondary)]">
                {chip.count}
              </span>
            </button>
          ))}
        </div>
        <ActiveFiltersSummary
          filters={filters}
          onClear={() => setFilters(EMPTY_INVENTORY_FILTERS)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--platform-text-secondary)]">Approval</label>
          <select
            value={approvalFilter}
            onChange={(e) => setApprovalFilter(e.target.value as ApprovalFilter)}
            className="platform-select w-full"
          >
            <option value="all">All approval states</option>
            <option value="pending_approval">Pending approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--platform-text-secondary)]">Body type</label>
          <select
            value={filters.bodyType}
            onChange={(e) => setFilters((f) => ({ ...f, bodyType: e.target.value }))}
            className="platform-select w-full"
          >
            <option value="all">All body types</option>
            <option value="SUV">SUV</option>
            <option value="Sedan">Sedan</option>
            <option value="Luxury">Luxury</option>
            <option value="Truck">Truck</option>
            <option value="Hatchback">Hatchback</option>
            <option value="Electric">Electric</option>
            <option value="Commercial">Commercial</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--platform-text-secondary)]">Status</label>
          <select
            value={filters.fulfillmentMode !== "all" ? "all" : filters.status}
            onChange={(e) => {
              const status = e.target.value;
              setFilters((f) => ({
                ...f,
                fulfillmentMode: "all",
                status,
              }));
              if (status === "available") setListingTab("available");
              else if (status === "pre_order") setListingTab("pre_order");
              else if (status === "all") setListingTab("all");
            }}
            className="platform-select w-full"
            disabled={filters.fulfillmentMode !== "all"}
          >
            <option value="all">All statuses</option>
            <option value="available">Buy now</option>
            <option value="pre_order">Pre-Order</option>
            <option value="reserved">Reserved</option>
            <option value="sold">Sold</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--platform-text-secondary)]">Fulfillment</label>
          <select
            value={filters.fulfillmentMode}
            onChange={(e) => {
              const mode = e.target.value as InventoryFilters["fulfillmentMode"];
              setFilters((prev) => {
                if (mode === "pre_order_only") setListingTab("pre_order");
                else if (mode === "all" && prev.status === "all") setListingTab("all");
                return {
                  ...prev,
                  fulfillmentMode: mode,
                  status: mode === "all" ? prev.status : "all",
                };
              });
            }}
            className="platform-select w-full"
          >
            <option value="all">All fulfillment</option>
            <option value="in_ghana">In Ghana now</option>
            <option value="import_ship">Import / ship</option>
            <option value="pre_order_only">Pre-order only</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--platform-text-secondary)]">Local stock</label>
          <select
            value={filters.availableLocally}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                availableLocally: e.target.value as InventoryFilters["availableLocally"],
              }))
            }
            className="platform-select w-full"
          >
            <option value="all">Any</option>
            <option value="yes">Locally available</option>
            <option value="no">Not local</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--platform-text-secondary)]">Transmission</label>
          <select
            value={filters.transmission}
            onChange={(e) => setFilters((f) => ({ ...f, transmission: e.target.value }))}
            className="platform-select w-full"
          >
            <option value="all">All transmissions</option>
            <option value="Automatic">Automatic</option>
            <option value="Manual">Manual</option>
            <option value="CVT">CVT</option>
            <option value="DCT">DCT</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--platform-text-secondary)]">Fuel</label>
          <select
            value={filters.fuelType}
            onChange={(e) => setFilters((f) => ({ ...f, fuelType: e.target.value }))}
            className="platform-select w-full"
          >
            <option value="all">All fuel types</option>
            <option value="Petrol">Petrol</option>
            <option value="Diesel">Diesel</option>
            <option value="Hybrid">Hybrid</option>
            <option value="Electric">Electric</option>
            <option value="Plug-in Hybrid">Plug-in Hybrid</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--platform-text-secondary)]">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-[var(--platform-text-secondary)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Make, model, VIN…"
              className="platform-input platform-input--icon"
            />
          </div>
        </div>
      </div>

      <div className="platform-card min-w-0 max-w-full overflow-hidden rounded-xl">
        {canEdit && selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--platform-border)] bg-[rgba(59,130,246,0.06)] px-4 py-3">
            <p className="text-sm text-[var(--platform-text)]">
              <span className="font-medium">{selectedIds.size}</span> selected
            </p>
            <select
              value={bulkStatus}
              onChange={(e) => {
                const status = e.target.value;
                setBulkStatus(status);
                if (status) void applyBulkStatus(status);
              }}
              className="platform-select min-h-9 min-w-[10rem] text-sm"
              aria-label="Bulk status change"
              disabled={bulkActing}
            >
              <option value="">Change status…</option>
              {(["available", "pre_order", "reserved", "sold"] as const).map((value) => (
                <option key={value} value={value}>
                  Mark as {VEHICLE_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={bulkActing}
              onClick={() => setBulkTrashConfirm(true)}
              className="platform-btn-ghost text-xs text-[var(--platform-error)] disabled:opacity-50"
            >
              Move to trash
            </button>
            <button
              type="button"
              disabled={bulkActing}
              onClick={() => {
                setSelectedIds(new Set());
                setBulkStatus("");
              }}
              className="text-xs text-[var(--platform-text-secondary)] hover:text-[var(--platform-text)] disabled:opacity-50"
            >
              Clear selection
            </button>
          </div>
        )}
        <VirtualTableScroll className="platform-table-scroll max-h-[min(70vh,48rem)] max-w-full overflow-x-auto overflow-y-auto">
          {(scrollRef) => (
          <table className="platform-table w-full min-w-[70rem] text-left text-sm">
            <colgroup>
              {canEdit && <col className="w-10" />}
              <col className="w-16" />
              <col className="w-[min(14rem,18%)]" />
              <col className="w-[min(10rem,12%)]" />
              <col className="w-[min(8rem,10%)]" />
              <col className="w-[min(7rem,8%)]" />
              <col className="w-[min(6rem,7%)]" />
              <col className="w-[min(7rem,8%)]" />
              <col className="w-[min(8rem,10%)]" />
              <col className="w-[min(9rem,11%)]" />
              <col className="w-[min(10rem,12%)]" />
            </colgroup>
            <thead>
              <tr className="text-xs text-[var(--platform-text-secondary)]">
                {canEdit && (
                  <th className="px-3 py-3 font-medium">
                    <input
                      type="checkbox"
                      checked={
                        filtered.length > 0 &&
                        filtered.every((v) => selectedIds.has(v.id))
                      }
                      onChange={toggleSelectAllVisible}
                      className="size-4 rounded border-[var(--platform-border)]"
                      aria-label="Select all visible vehicles"
                    />
                  </th>
                )}
                <th className="px-4 py-3 font-medium">Photo</th>
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Mileage</th>
                <th className="px-4 py-3 font-medium" title="Identical cars covered by this listing">
                  Units
                </th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Approval</th>
                <th className="px-4 py-3 font-medium">Listed</th>
                <th className="px-4 py-3 font-medium">{canEdit || canApprove ? "Actions" : "Links"}</th>
              </tr>
            </thead>
            <VirtualTableBody
              scrollRef={scrollRef}
              items={filtered}
              colSpan={canEdit ? 11 : 10}
              rowHeight={88}
              getKey={(v) => v.id}
              emptyRow={
                <tr>
                  <td
                    colSpan={canEdit ? 11 : 10}
                    className="px-4 py-12 text-center text-[var(--platform-text-secondary)]"
                  >
                    No vehicles match your filters.
                  </td>
                </tr>
              }
              renderRow={(v) => {
                  const approvalStatus = v.approval_status ?? "approved";
                  const isPending = approvalStatus === "pending_approval";
                  const isRejected = approvalStatus === "rejected";
                  const isEditPending = hasPendingEdits(v.pending_changes);
                  const isRejectedEdit = isRejectedEditPending(approvalStatus, v.pending_changes);
                  const needsReview = isPending || isRejected;
                  const display = isEditPending
                    ? mergeVehicleWithPending(v, v.pending_changes)
                    : v;
                  const isLive = isPubliclyListed(approvalStatus, v.pending_changes);
                  const modelAvailable = availableCountForVehicle(v, availableStockCounts);
                  const stockLevel = modelStockLevel(modelAvailable);
                  const showStockHighlight = shouldHighlightVehicleStock(v, availableStockCounts);
                  const thumb = primaryPhotoFor({
                    slug: v.slug,
                    id: v.id,
                    bodyType: display.body_type as BodyType,
                    primary_image_url: display.primary_image_url,
                    additional_images: display.additional_images,
                    gallery: display.gallery,
                    images: display.images,
                  });
                  return (
                    <tr
                      className={cn(
                        "border-t border-[var(--platform-border)]",
                        actingOnId === v.id && "opacity-60",
                        showStockHighlight &&
                          stockLevel === "out" &&
                          "bg-red-50/90 ring-1 ring-inset ring-red-200/80",
                        showStockHighlight &&
                          stockLevel === "low" &&
                          "bg-amber-50/90 ring-1 ring-inset ring-amber-200/80"
                      )}
                    >
                      {canEdit && (
                        <td className="px-3 py-3 align-middle">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(v.id)}
                            onChange={() => toggleSelected(v.id)}
                            disabled={actingOnId === v.id}
                            className="size-4 rounded border-[var(--platform-border)]"
                            aria-label={`Select ${display.year} ${display.make} ${display.model}`}
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="relative size-12 overflow-hidden rounded-md border border-[var(--platform-border)] bg-[var(--platform-bg)]">
                          <SafeVehicleImage
                            src={thumb}
                            alt={`${display.year} ${display.make} ${display.model}`}
                            fill={false}
                            width={48}
                            height={48}
                            className="size-12"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <p className="font-medium leading-snug">
                          {display.year} {display.make} {display.model}
                        </p>
                        {showStockHighlight && (
                          <p
                            className={cn(
                              "mt-0.5 inline-flex items-center gap-1 text-xs font-semibold",
                              stockLevel === "out" ? "text-red-700" : "text-amber-700"
                            )}
                          >
                            <AlertTriangle className="size-3" aria-hidden />
                            {stockLevel === "out"
                              ? "Out of available stock"
                              : `Low Stock · ${modelAvailable} available`}
                          </p>
                        )}
                        {isEditPending && !isRejectedEdit && (
                          <p className="mt-0.5 text-xs text-[var(--platform-accent)]">
                            Proposed edits awaiting approval
                          </p>
                        )}
                        {isRejectedEdit && (
                          <p className="mt-0.5 text-xs text-[var(--platform-error)]">
                            Rejected edits — re-approve or dismiss
                          </p>
                        )}
                        <p className="mt-0.5 truncate text-xs text-[var(--platform-text-secondary)]">
                          {v.location}
                        </p>
                        {(() => {
                          const exteriorColor = resolveExteriorColor(display);
                          if (!exteriorColor) return null;
                          return (
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--platform-text-secondary)]">
                              <VehicleColorSwatch color={exteriorColor} />
                              <span className="truncate">{exteriorColor}</span>
                            </p>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <CategoryBadges vehicle={v} variant="platform" compact />
                      </td>
                      <td className="px-4 py-3 align-middle whitespace-nowrap">
                        <p className="font-medium tabular-nums">
                          {formatVehicleListPrice({
                            price: Number(display.price) || 0,
                            priceCurrency: display.price_currency,
                            listedPrice: display.listed_price,
                          })}
                        </p>
                        <p className="text-xs text-[var(--platform-text-secondary)]">
                          {formatAdminCurrencyPreviews(Number(display.price) || 0)}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-middle tabular-nums whitespace-nowrap">
                        {display.mileage.toLocaleString()} km
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {canEdit ? (
                          <input
                            type="number"
                            min={0}
                            step={1}
                            defaultValue={normalizeStockQuantity(
                              display.stock_quantity ?? v.stock_quantity,
                              1
                            )}
                            key={`${v.id}-${normalizeStockQuantity(display.stock_quantity ?? v.stock_quantity, 1)}-${isEditPending ? "p" : "l"}`}
                            disabled={actingOnId === v.id}
                            onBlur={(e) => {
                              const next = normalizeStockQuantity(e.target.value, 0);
                              const current = normalizeStockQuantity(
                                display.stock_quantity ?? v.stock_quantity,
                                1
                              );
                              if (next === current) return;
                              void updateVehicleQuantity(
                                v.id,
                                `${display.year} ${display.make} ${display.model}`,
                                next
                              ).then((ok) => {
                                if (ok) void load();
                                else e.target.value = String(current);
                              });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="platform-input w-16 px-2 py-1 text-center tabular-nums"
                            aria-label={`Units in stock for ${display.year} ${display.make} ${display.model}`}
                            title="How many identical cars this listing covers. Marking sold reduces this by 1."
                          />
                        ) : (
                          <span className="tabular-nums">
                            {normalizeStockQuantity(
                              display.stock_quantity ?? v.stock_quantity,
                              1
                            )}
                          </span>
                        )}
                        {modelAvailable !==
                          normalizeStockQuantity(
                            display.stock_quantity ?? v.stock_quantity,
                            1
                          ) &&
                          v.status === "available" && (
                            <p className="mt-0.5 text-[10px] text-[var(--platform-text-secondary)]">
                              Model: {modelAvailable}
                            </p>
                          )}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <VehicleStatusControl
                          status={v.status}
                          editable={canEdit}
                          loading={actingOnId === v.id}
                          onStatusChange={(status) =>
                            requestStatusChange(
                              v.id,
                              `${display.year} ${display.make} ${display.model}`,
                              status,
                              v.status
                            )
                          }
                        />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="space-y-1">
                          <ApprovalStatusBadge status={approvalStatus} />
                          {approvalStatus === "rejected" && v.approval_note && (
                            <p className="max-w-[10rem] text-xs text-[var(--platform-text-secondary)]">
                              {v.approval_note}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-xs text-[var(--platform-text-secondary)]">
                        <PlatformDateTime value={v.created_at} className="text-xs" />
                        {v.updated_at && v.updated_at !== v.created_at ? (
                          <p className="mt-0.5 text-[10px]">
                            Updated{" "}
                            <PlatformDateTime value={v.updated_at} className="text-[10px]" />
                          </p>
                        ) : null}
                        {v.reviewed_at ? (
                          <p className="mt-0.5 text-[10px]">
                            Reviewed{" "}
                            <PlatformDateTime value={v.reviewed_at} className="text-[10px]" />
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2 text-xs">
                          {canApprove && needsReview && (
                            <>
                              <button
                                type="button"
                                disabled={actingOnId === v.id}
                                onClick={() =>
                                  setApproveTarget({
                                    id: v.id,
                                    summary: buildVehiclePublishSummary({
                                      year: Number(display.year),
                                      make: String(display.make),
                                      model: String(display.model),
                                      trim: display.trim ? String(display.trim) : undefined,
                                      price:
                                        display.listed_price != null
                                          ? Number(display.listed_price) || 0
                                          : Number(display.price) || 0,
                                      price_currency:
                                        display.price_currency ?? undefined,
                                      mileage: Number(display.mileage) || 0,
                                      color: display.color ? String(display.color) : undefined,
                                      status: String(display.status ?? "available"),
                                      location: String(display.location ?? ""),
                                      body_type: display.body_type as VehicleInput["body_type"],
                                      fuel_type: display.fuel_type as VehicleInput["fuel_type"],
                                      transmission:
                                        display.transmission as VehicleInput["transmission"],
                                      condition: display.condition as VehicleInput["condition"],
                                      primary_image_url:
                                        display.primary_image_url ??
                                        display.images?.[0] ??
                                        undefined,
                                      additional_images: display.additional_images ?? undefined,
                                      images: display.images,
                                      gallery: display.gallery,
                                      featured: Boolean(display.featured),
                                    }),
                                  })
                                }
                                className="inline-flex items-center gap-1 text-[var(--platform-success)] hover:underline disabled:opacity-50"
                              >
                                <Check className="size-3" />
                                {isRejected ? "Re-approve" : "Approve"}
                              </button>
                              {isRejectedEdit && (
                                <button
                                  type="button"
                                  disabled={actingOnId === v.id}
                                  onClick={() => reviewVehicle(v.id, "dismiss")}
                                  className="inline-flex items-center gap-1 text-[var(--platform-text-secondary)] hover:underline disabled:opacity-50"
                                >
                                  Discard edits
                                </button>
                              )}
                              {isPending && (
                                <button
                                  type="button"
                                  disabled={actingOnId === v.id}
                                  onClick={() =>
                                    setRejectTarget({
                                      id: v.id,
                                      name: `${display.year} ${display.make} ${display.model}`,
                                      isEdit: isEditPending,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 text-[var(--platform-error)] hover:underline disabled:opacity-50"
                                >
                                  <X className="size-3" />
                                  Reject
                                </button>
                              )}
                            </>
                          )}
                          {canEdit && v.status !== "available" && (
                            <button
                              type="button"
                              disabled={actingOnId === v.id}
                              onClick={() =>
                                requestStatusChange(
                                  v.id,
                                  `${display.year} ${display.make} ${display.model}`,
                                  "available",
                                  v.status
                                )
                              }
                              className="text-[var(--platform-success)] hover:underline disabled:opacity-50"
                            >
                              Mark available
                            </button>
                          )}
                          {canEdit && v.status !== "pre_order" && (
                            <button
                              type="button"
                              disabled={actingOnId === v.id}
                              onClick={() =>
                                requestStatusChange(
                                  v.id,
                                  `${display.year} ${display.make} ${display.model}`,
                                  "pre_order",
                                  v.status
                                )
                              }
                              className="text-[var(--platform-accent)] hover:underline disabled:opacity-50"
                            >
                              Mark pre-order
                            </button>
                          )}
                          {canEdit && v.status === "sold" && (
                            <button
                              type="button"
                              disabled={actingOnId === v.id}
                              title="Use when more stock of this model exists"
                              onClick={() =>
                                requestStatusChange(
                                  v.id,
                                  `${display.year} ${display.make} ${display.model}`,
                                  "available",
                                  v.status
                                )
                              }
                              className="text-[var(--platform-success)] hover:underline disabled:opacity-50"
                            >
                              Make available again
                            </button>
                          )}
                          {canEdit && (
                            <Link
                              href={platformPath(`inventory/${v.id}/edit`)}
                              className="text-[var(--platform-accent)] hover:underline"
                            >
                              Edit
                            </Link>
                          )}
                          {isLive && (
                            <a
                              href={`/auto/inventory/${v.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[var(--platform-text-secondary)] hover:text-[var(--platform-text)]"
                            >
                              View
                            </a>
                          )}
                          {canEdit && (canApprove || approvalStatus !== "approved") && (
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  id: v.id,
                                  name: `${v.year} ${v.make} ${v.model}`,
                                })
                              }
                              className="text-[var(--platform-error)] hover:underline"
                            >
                              Move to trash
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
              }}
            />
          </table>
          )}
        </VirtualTableScroll>
        <div className="border-t border-[var(--platform-border)] px-4 py-3 text-xs text-[var(--platform-text-secondary)]">
          Showing {filtered.length} of {vehicles.length} vehicles
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(statusConfirmTarget)}
        onOpenChange={(open) => {
          if (!open) setStatusConfirmTarget(null);
        }}
        title="Mark as sold?"
        description={
          statusConfirmTarget
            ? statusConfirmTarget.bulk
              ? `Mark one unit sold on each of ${statusConfirmTarget.name}? Multi-unit listings reduce Units by 1 and stay available. A last unit of a model moves to pre-order; otherwise the listing is marked sold and hidden from buy-now inventory.`
              : `Mark one unit of ${statusConfirmTarget.name} as sold? If this listing has multiple units, Units decreases by 1 and it stays available. If it is the last unit of this model, the listing moves to pre-order; otherwise it is marked sold.`
            : ""
        }
        confirmLabel="Mark sold"
        destructive
        onConfirm={async () => {
          if (!statusConfirmTarget) return;
          if (statusConfirmTarget.bulk) {
            const ids = [...selectedIds];
            let failed = 0;
            for (const id of ids) {
              const ok = await updateVehicleStatus(id, "sold");
              if (!ok) failed++;
            }
            await load();
            if (failed === 0) {
              setSelectedIds(new Set());
              setBulkStatus("");
              setToast(
                `Marked ${ids.length} vehicle${ids.length === 1 ? "" : "s"} as sold.`
              );
            } else {
              setToast(`Updated ${ids.length - failed} of ${ids.length} vehicles. Some updates failed.`);
            }
          } else {
            const ok = await updateVehicleStatus(
              statusConfirmTarget.id,
              "sold",
              `${statusConfirmTarget.name} marked as sold.`
            );
            if (ok) await load();
          }
          setStatusConfirmTarget(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectNote("");
          }
        }}
        title="Reject vehicle?"
        description={
          rejectTarget
            ? rejectTarget.isEdit
              ? `Reject proposed edits to ${rejectTarget.name}? The live listing will stay published with its current details.`
              : `Reject ${rejectTarget.name}? It will stay hidden from the public site until resubmitted.`
            : ""
        }
        confirmLabel="Reject"
        destructive
        onConfirm={async () => {
          if (rejectTarget) {
            await reviewVehicle(rejectTarget.id, "reject", rejectNote, rejectTarget.isEdit);
          }
        }}
      >
        {rejectTarget && (
          <div className="space-y-1.5 px-1">
            <label className="text-xs font-medium text-[var(--platform-text-secondary)]">
              Note for manager (optional)
            </label>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              className="platform-input w-full resize-y"
              placeholder="Reason for rejection…"
            />
          </div>
        )}
      </ConfirmDialog>

      {approveTarget ? (
        <VehiclePublishConfirmDialog
          open={Boolean(approveTarget)}
          onOpenChange={(open) => {
            if (!open) setApproveTarget(null);
          }}
          summary={approveTarget.summary}
          mode="approve"
          onConfirm={async () => {
            await reviewVehicle(approveTarget.id, "approve");
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Move vehicle to trash?"
        description={
          deleteTarget
            ? `${deleteTarget.name} will be removed from inventory and the public site, but kept in Trash where it can be restored. Fleet counts will exclude it until restored or permanently deleted.`
            : ""
        }
        confirmLabel="Move to trash"
        destructive
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={async () => {
          if (deleteTarget) await deleteVehicle(deleteTarget.id, deleteTarget.name);
        }}
      />

      <ConfirmDialog
        open={bulkTrashConfirm}
        onOpenChange={(open) => {
          if (!open && !bulkActing) setBulkTrashConfirm(false);
        }}
        title="Move selected vehicles to trash?"
        description={`Move ${selectedIds.size} vehicle${selectedIds.size === 1 ? "" : "s"} to trash? They will be removed from inventory and the public site, but kept in Trash where they can be restored.`}
        confirmLabel="Move to trash"
        destructive
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={applyBulkTrash}
      />
    </div>
  );
}
