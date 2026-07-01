"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Download, Plus, Search, X } from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import { ConfirmDialog } from "@/components/platform/confirm-dialog";
import { ApprovalStatusBadge, StatusBadge } from "@/components/platform/status-badge";
import {
  ActiveFiltersSummary,
  CategoryBadges,
  mergeFilters,
} from "@/components/admin/category-badges";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
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
import type { BodyType } from "@/lib/types";
import type { DbVehicle } from "@/lib/platform/types";
import { PlatformDateTime } from "@/components/platform/platform-datetime";
import { downloadCsv, exportVehiclesCsv } from "@/lib/platform/data";
import { usePlatformSession } from "@/components/platform/platform-shell";
import { adminErrorMessage, parseAdminResponse } from "@/lib/admin/client";
import {
  hasPendingEdits,
  isPubliclyListed,
  isRejectedEditPending,
  mergeVehicleWithPending,
} from "@/lib/admin/vehicle-pending-changes";

type ApprovalFilter = "all" | "pending_approval" | "approved" | "rejected";
type ListingTab = "all" | "available" | "pre_order";

export default function InventoryPage() {
  const router = useRouter();
  const session = usePlatformSession();
  const canEdit = session?.permissions.inventory_edit ?? false;
  const canApprove = session?.permissions.inventory_approve ?? false;
  const isManager = session?.role === "manager";
  const { formatPrice } = usePlatformCurrency();
  const searchParams = useSearchParams();
  const [vehicles, setVehicles] = useState<DbVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [filters, setFilters] = useState<InventoryFilters>(EMPTY_INVENTORY_FILTERS);
  const [toast, setToast] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{
    id: string;
    name: string;
    isEdit: boolean;
  } | null>(null);
  const [rejectNote, setRejectNote] = useState("");
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

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/vehicles");
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = await res.json();
    setVehicles(json.vehicles ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) setSearch(q);
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
    if (listingTab === "available") {
      list = list.filter((v) => v.status === "available");
    } else if (listingTab === "pre_order") {
      list = list.filter((v) => v.status === "pre_order");
    }
    if (approvalFilter !== "all") {
      list = list.filter((v) => (v.approval_status ?? "approved") === approvalFilter);
    }
    return [...list].sort((a, b) => {
      const makeCmp = a.make.localeCompare(b.make, undefined, { sensitivity: "base" });
      if (makeCmp !== 0) return makeCmp;
      return b.year - a.year;
    });
  }, [vehicles, filters, search, approvalFilter, listingTab]);

  const chips = useMemo(() => buildFilterChips(vehicles), [vehicles]);

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
    filters.brandOrigin !== "all";

  async function updateVehicleStatus(id: string, status: string, successMessage: string) {
    setActingOnId(id);
    const res = await fetch("/api/admin/vehicles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const json = await parseAdminResponse(res);
    setActingOnId(null);
    if (!res.ok || !json.ok) {
      setToast(adminErrorMessage(json, "Could not update vehicle status."));
      return;
    }
    const autoNote =
      json.autoPreOrder && status === "sold"
        ? " Listing moved to pre-order — last unit of this model."
        : "";
    setToast(`${successMessage}${autoNote}`);
    load();
  }

  async function deleteVehicle(id: string, name: string) {
    const res = await fetch(`/api/admin/vehicles?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      setToast("Vehicle moved to trash. Restore it from Platform → Trash if needed.");
      setDeleteTarget(null);
      load();
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
      body: JSON.stringify({ id, action, note: note?.trim() || undefined }),
    });
    const json = await parseAdminResponse(res);
    setActingOnId(null);
    if (!res.ok || !json.ok) {
      setToast(adminErrorMessage(json, "Could not update approval status."));
      return;
    }
    setRejectTarget(null);
    setRejectNote("");
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
    <div className="space-y-6">
      <PageHeader
        title="Vehicle inventory"
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
            <button type="button" onClick={handleExport} className="platform-btn-ghost">
              <Download className="size-4" />
              Export CSV
            </button>
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
                  setFilters((f) => ({ ...f, status: "all" }));
                } else {
                  setFilters((f) => ({ ...f, status: tab.id }));
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
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="platform-select w-full"
          >
            <option value="all">All statuses</option>
            <option value="available">Available</option>
            <option value="pre_order">Pre-Order</option>
            <option value="reserved">Reserved</option>
            <option value="sold">Sold</option>
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

      <div className="platform-card overflow-hidden rounded-xl">
        <div className="max-h-[min(70vh,48rem)] overflow-auto">
          <table className="platform-table w-full min-w-[64rem] text-left text-sm">
            <colgroup>
              <col className="w-16" />
              <col className="w-[min(14rem,20%)]" />
              <col className="w-[min(10rem,14%)]" />
              <col className="w-[min(8rem,11%)]" />
              <col className="w-[min(7rem,9%)]" />
              <col className="w-[min(7rem,9%)]" />
              <col className="w-[min(8rem,11%)]" />
              <col className="w-[min(9rem,12%)]" />
              <col className="w-[min(10rem,14%)]" />
            </colgroup>
            <thead>
              <tr className="text-xs text-[var(--platform-text-secondary)]">
                <th className="px-4 py-3 font-medium">Photo</th>
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Mileage</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Approval</th>
                <th className="px-4 py-3 font-medium">Listed</th>
                <th className="px-4 py-3 font-medium">{canEdit || canApprove ? "Actions" : "Links"}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-[var(--platform-text-secondary)]"
                  >
                    No vehicles match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((v) => {
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
                  const thumb = primaryPhotoFor({
                    slug: v.slug,
                    id: v.id,
                    bodyType: display.body_type as BodyType,
                    gallery: display.gallery,
                    images: display.images,
                  });
                  return (
                    <tr key={v.id} className="border-t border-[var(--platform-border)]">
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
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <CategoryBadges vehicle={v} variant="platform" compact />
                      </td>
                      <td className="px-4 py-3 align-middle whitespace-nowrap">
                        <p className="font-medium tabular-nums">
                          {formatPrice(display.price)}
                        </p>
                        <p className="text-xs text-[var(--platform-text-secondary)]">
                          {formatAdminCurrencyPreviews(display.price)}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-middle tabular-nums whitespace-nowrap">
                        {display.mileage.toLocaleString()} km
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <StatusBadge status={v.status} />
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
                                onClick={() => reviewVehicle(v.id, "approve")}
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
                          {canEdit && v.status === "sold" && (
                            <button
                              type="button"
                              disabled={actingOnId === v.id}
                              title="Use when more stock of this model exists"
                              onClick={() =>
                                updateVehicleStatus(
                                  v.id,
                                  "available",
                                  `${display.year} ${display.make} ${display.model} is available again.`
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
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[var(--platform-border)] px-4 py-3 text-xs text-[var(--platform-text-secondary)]">
          Showing {filtered.length} of {vehicles.length} vehicles
        </div>
      </div>

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
        onConfirm={async () => {
          if (deleteTarget) await deleteVehicle(deleteTarget.id, deleteTarget.name);
        }}
      />
    </div>
  );
}
