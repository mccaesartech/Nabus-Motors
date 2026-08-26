"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, MessageSquare, Search, ShoppingBag, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import {
  ConfirmDialog,
  DELETE_CONFIRM_PHRASE,
} from "@/components/platform/confirm-dialog";
import { PaymentStatusBadge, StatusBadge } from "@/components/platform/status-badge";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { usePlatformSession } from "@/components/platform/platform-shell";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { unifyLeads } from "@/lib/platform/data";
import { canDirectMutate } from "@/lib/platform/mutation-approval";
import type { InquiryData, UnifiedLead } from "@/lib/platform/types";
import { LEAD_SOURCE_OPTIONS, LEAD_STATUS_OPTIONS, ORDER_STATUS_OPTIONS, leadTypeLabel } from "@/lib/platform/types";
import { CUSTOM_REQUEST_STATUS_OPTIONS } from "@/lib/platform/custom-request";
import { cn } from "@/lib/utils";
import { PlatformDateTime } from "@/components/platform/platform-datetime";

const TYPE_TABS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "order", label: "Cart orders" },
  { value: "preorder", label: "Pre-Order" },
  { value: "contact", label: "Contact" },
  { value: "vehicle", label: "Vehicle" },
  { value: "finance", label: "Finance" },
  { value: "appraisal", label: "Trade-in" },
];

function rowKey(lead: UnifiedLead) {
  return `${lead.type}-${lead.id}`;
}

export default function LeadsPage() {
  const router = useRouter();
  const session = usePlatformSession();
  const canMutate = session ? canDirectMutate(session.role) : false;
  const searchParams = useSearchParams();
  const [inquiries, setInquiries] = useState<InquiryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState(
    () => searchParams.get("status") ?? "all"
  );
  const [typeFilter, setTypeFilter] = useState(() => searchParams.get("tab") ?? "all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [customFilter, setCustomFilter] = useState<"all" | "custom" | "catalog">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<UnifiedLead | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/inquiries");
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = await res.json();
    setInquiries(json.data ?? {});
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const status = searchParams.get("status");
    const q = searchParams.get("q");
    const orderId = searchParams.get("order");
    if (tab) setTypeFilter(tab);
    if (status) setStatusFilter(status);
    if (q !== null) setSearch(q);
    if (orderId) {
      router.replace(`/platform/leads/order/${encodeURIComponent(orderId)}`);
    }
  }, [searchParams, router]);

  const leads = useMemo(() => (inquiries ? unifyLeads(inquiries) : []), [inquiries]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    for (const lead of leads) {
      counts[lead.type] = (counts[lead.type] ?? 0) + 1;
    }
    return counts;
  }, [leads]);

  const statusOptions = useMemo(() => {
    if (typeFilter === "order") return ORDER_STATUS_OPTIONS;
    return LEAD_STATUS_OPTIONS;
  }, [typeFilter]);

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (typeFilter !== "all" && lead.type !== typeFilter) return false;
      if (sourceFilter !== "all" && lead.source !== sourceFilter) return false;
      if (typeFilter === "preorder" && customFilter === "custom" && !lead.isCustomRequest) {
        return false;
      }
      if (typeFilter === "preorder" && customFilter === "catalog" && lead.isCustomRequest) {
        return false;
      }
      if (!search) return true;
      const q = search.toLowerCase();
      const phone = lead.phone?.toLowerCase() ?? "";
      const ref = lead.referenceCode?.toLowerCase() ?? "";
      return (
        lead.id.toLowerCase().includes(q) ||
        lead.name.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        phone.includes(q) ||
        ref.includes(q) ||
        lead.summary.toLowerCase().includes(q) ||
        (lead.vehicleTitle?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [leads, search, statusFilter, typeFilter, sourceFilter, customFilter]);

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((lead) => selectedIds.has(rowKey(lead)));

  function removeLeadsOptimistically(targets: UnifiedLead[]) {
    const byType = new Map<UnifiedLead["type"], Set<string>>();
    for (const lead of targets) {
      const set = byType.get(lead.type) ?? new Set<string>();
      set.add(lead.id);
      byType.set(lead.type, set);
    }
    setInquiries((prev) => {
      if (!prev) return prev;
      const next: InquiryData = { ...prev };
      for (const [type, ids] of byType) {
        const rows = next[type];
        if (!rows) continue;
        next[type] = rows.filter((row) => !ids.has(String(row.id)));
      }
      return next;
    });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const lead of targets) next.delete(rowKey(lead));
      return next;
    });
  }

  async function updateLead(
    lead: UnifiedLead,
    updates: { status?: string; follow_up_notes?: string; source?: string }
  ) {
    const typeKey = lead.type as keyof InquiryData;
    const snapshot = inquiries;
    setInquiries((prev) => {
      if (!prev) return prev;
      const rows = prev[typeKey];
      if (!rows) return prev;
      return {
        ...prev,
        [typeKey]: rows.map((row) => {
          if (String(row.id) !== lead.id) return row;
          const next = { ...row } as Record<string, unknown>;
          if (updates.status !== undefined) next.status = updates.status;
          if (updates.source !== undefined) next.source = updates.source;
          if (updates.follow_up_notes !== undefined) {
            if (lead.type === "order") next.notes = updates.follow_up_notes;
            else next.follow_up_notes = updates.follow_up_notes;
          }
          return next;
        }),
      };
    });

    const res = await fetch("/api/admin/inquiries/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: lead.type, id: lead.id, ...updates }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) {
      setInquiries(snapshot);
      setToastError(true);
      setToast(json.message ?? "Could not update lead.");
      return;
    }
    if (json.record) {
      setInquiries((prev) => {
        if (!prev) return prev;
        const rows = prev[typeKey];
        if (!rows) return prev;
        return {
          ...prev,
          [typeKey]: rows.map((row) =>
            String(row.id) === lead.id ? (json.record as Record<string, unknown>) : row
          ),
        };
      });
    }
  }

  async function deleteLeads(targets: UnifiedLead[]) {
    if (targets.length === 0) return;

    setDeleteTarget(null);
    setBulkDeleteConfirm(false);
    removeLeadsOptimistically(targets);
    setDeleting(true);
    setToastError(false);
    setToast(
      targets.length === 1
        ? "Moving lead to trash…"
        : `Moving ${targets.length} leads to trash…`
    );

    const results = await Promise.all(
      targets.map(async (lead) => {
        try {
          const res = await fetch(
            `/api/admin/inquiries?type=${encodeURIComponent(lead.type)}&id=${encodeURIComponent(lead.id)}`,
            { method: "DELETE" }
          );
          return { lead, ok: res.ok };
        } catch {
          return { lead, ok: false };
        }
      })
    );

    const failed = results.filter((r) => !r.ok).map((r) => r.lead);
    const deletedCount = targets.length - failed.length;

    await load();

    setDeleting(false);
    if (failed.length === 0) {
      setToastError(false);
      setToast(
        deletedCount === 1
          ? "Lead moved to trash. Restore it from Platform → Trash if needed."
          : `Moved ${deletedCount} leads to trash. Restore from Platform → Trash if needed.`
      );
    } else if (deletedCount > 0) {
      setToastError(true);
      setToast(
        `Moved ${deletedCount} of ${targets.length} leads to trash. Some deletions failed.`
      );
    } else {
      setToastError(true);
      setToast("Could not move lead(s) to trash.");
    }
  }

  function toggleSelected(key: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    const visibleKeys = filtered.map(rowKey);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleKeys.forEach((key) => next.delete(key));
      } else {
        visibleKeys.forEach((key) => next.add(key));
      }
      return next;
    });
  }

  const selectedLeads = useMemo(
    () => leads.filter((lead) => selectedIds.has(rowKey(lead))),
    [leads, selectedIds]
  );

  if (loading) {
    return <p className="text-sm text-[var(--platform-text-secondary)]">Loading leads…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Track inquiries from the website, WhatsApp, and other channels. Update status and follow-up notes."
        breadcrumb="Leads"
      />

      <div className="flex flex-wrap gap-2">
        {TYPE_TABS.map((tab) => {
          const count = typeCounts[tab.value] ?? 0;
          if (tab.value !== "all" && tab.value !== "order" && count === 0) return null;
          const active = typeFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setTypeFilter(tab.value);
                if (tab.value === "order") setStatusFilter("all");
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-[var(--platform-accent)] bg-[rgba(139,92,246,0.1)] text-[var(--platform-accent)]"
                  : "border-[var(--platform-border)] text-[var(--platform-text-secondary)] hover:border-[var(--platform-accent)]"
              )}
            >
              {tab.value === "order" ? <ShoppingBag className="size-3.5" /> : null}
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  active ? "bg-[var(--platform-accent)] text-white" : "bg-[var(--platform-bg)]"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {typeFilter === "preorder" && (
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: "all", label: "All pre-orders" },
              { value: "custom", label: "Custom requests" },
              { value: "catalog", label: "Catalog vehicles" },
            ] as const
          ).map((item) => {
            const active = customFilter === item.value;
            const count =
              item.value === "all"
                ? leads.filter((l) => l.type === "preorder").length
                : item.value === "custom"
                  ? leads.filter((l) => l.type === "preorder" && l.isCustomRequest).length
                  : leads.filter((l) => l.type === "preorder" && !l.isCustomRequest).length;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setCustomFilter(item.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-[var(--platform-accent)] bg-[rgba(139,92,246,0.1)] text-[var(--platform-accent)]"
                    : "border-[var(--platform-border)] text-[var(--platform-text-secondary)] hover:border-[var(--platform-accent)]"
                )}
              >
                {item.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-[var(--platform-text-secondary)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={typeFilter === "order" ? "Search orders by name, email, or order ID…" : "Search leads…"}
            className="platform-input platform-input--icon"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            if (e.target.value === "order") setStatusFilter("all");
          }}
          className="platform-select"
        >
          <option value="all">All types</option>
          <option value="contact">Contact</option>
          <option value="vehicle">Vehicle</option>
          <option value="preorder">Pre-Order</option>
          <option value="order">Cart orders ({typeCounts.order ?? 0})</option>
          <option value="finance">Finance</option>
          <option value="appraisal">Trade-in</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="platform-select"
        >
          <option value="all">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="platform-select"
        >
          <option value="all">All sources</option>
          {LEAD_SOURCE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {toast && (
        <div
          role="status"
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            toastError
              ? "border-red-500/40 bg-red-500/10 text-red-800"
              : "border-[var(--platform-success)]/30 bg-[rgba(16,185,129,0.08)] text-[var(--platform-success)]"
          )}
        >
          {toast}
        </div>
      )}

      {selectedIds.size > 0 && canMutate && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface)] px-4 py-3 text-sm">
          <span>
            <span className="font-medium">{selectedIds.size}</span> selected
          </span>
          <button
            type="button"
            className="platform-btn-secondary inline-flex items-center gap-2 text-xs text-red-700"
            disabled={deleting}
            onClick={() => setBulkDeleteConfirm(true)}
          >
            <Trash2 className="size-3.5" />
            Move to trash
          </button>
          <button
            type="button"
            className="platform-btn-ghost text-xs"
            disabled={deleting}
            onClick={() => setSelectedIds(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="platform-card overflow-hidden rounded-xl">
        <div className="max-h-[min(70vh,48rem)] overflow-auto">
          <table className="platform-table w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-[var(--platform-text-secondary)]">
                <th className="w-10 px-3 py-3 font-medium">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    disabled={filtered.length === 0 || deleting}
                    className="size-4 rounded border-[var(--platform-border)]"
                    aria-label="Select all visible leads"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">Summary</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-12 text-center text-[var(--platform-text-secondary)]"
                  >
                    {leads.length === 0 ? (
                      <>
                        <p className="font-medium text-[var(--platform-text)]">No leads yet</p>
                        <p className="mt-1 text-sm">
                          They&apos;ll appear here when customers submit forms on the website.
                        </p>
                      </>
                    ) : (
                      "No leads match your filters."
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => {
                  const key = rowKey(lead);
                  const expanded = expandedId === key;
                  const isClickable = Boolean(lead.detailLink);
                  const statusChoices =
                    lead.type === "order"
                      ? ORDER_STATUS_OPTIONS
                      : lead.isCustomRequest
                        ? CUSTOM_REQUEST_STATUS_OPTIONS
                        : LEAD_STATUS_OPTIONS;
                  return (
                    <tr
                      key={key}
                      role={isClickable ? "button" : undefined}
                      tabIndex={isClickable ? 0 : undefined}
                      className={cn(
                        "border-t border-[var(--platform-border)] align-top",
                        isClickable &&
                          "cursor-pointer select-none hover:bg-[rgba(139,92,246,0.04)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--platform-accent)]"
                      )}
                      onClick={() => {
                        if (isClickable && lead.detailLink) router.push(lead.detailLink);
                      }}
                      onKeyDown={(e) => {
                        if (
                          isClickable &&
                          lead.detailLink &&
                          (e.key === "Enter" || e.key === " ")
                        ) {
                          e.preventDefault();
                          router.push(lead.detailLink);
                        }
                      }}
                    >
                      <td
                        className="px-3 py-3"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(key)}
                          onChange={() => toggleSelected(key)}
                          disabled={deleting}
                          className="size-4 rounded border-[var(--platform-border)]"
                          aria-label={`Select ${lead.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[var(--platform-text-secondary)]">
                        <PlatformDateTime value={lead.createdAt} className="text-xs" />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{lead.name}</p>
                        <p className="text-xs text-[var(--platform-text-secondary)]">
                          {lead.email}
                        </p>
                        {lead.phone && (
                          <p className="text-xs text-[var(--platform-text-secondary)]">
                            {lead.phone}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {lead.vehicleTitle ? (
                          lead.detailLink ? (
                            <Link
                              href={lead.detailLink}
                              className="flex max-w-[12rem] items-center gap-2 hover:opacity-90"
                            >
                              {lead.vehicleImage && (
                                <div className="relative size-10 shrink-0 overflow-hidden rounded bg-[var(--platform-bg)]">
                                  <SafeVehicleImage
                                    src={lead.vehicleImage}
                                    alt={lead.vehicleTitle}
                                    width={40}
                                    height={40}
                                    fill={false}
                                  />
                                </div>
                              )}
                              <span className="line-clamp-2 text-xs text-[var(--platform-accent)] hover:underline">
                                {lead.vehicleTitle}
                              </span>
                            </Link>
                          ) : (
                            <span className="line-clamp-2 text-xs">{lead.vehicleTitle}</span>
                          )
                        ) : (
                          <span className="text-xs text-[var(--platform-text-secondary)]">—</span>
                        )}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-[var(--platform-text-secondary)]">
                        {lead.summary}
                      </td>
                      <td className="px-4 py-3 text-[var(--platform-text-secondary)]">
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {leadTypeLabel(lead.type, lead.isCustomRequest)}
                          {lead.isCustomRequest && (
                            <span className="rounded-full bg-[rgba(212,175,55,0.2)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9a7b1a]">
                              Custom
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {lead.type === "order" ? (
                          <span className="text-xs text-[var(--platform-text-secondary)]">Cart</span>
                        ) : (
                          <select
                            value={lead.source}
                            onChange={(e) =>
                              updateLead(lead, { source: e.target.value })
                            }
                            className="platform-select text-xs"
                          >
                            {LEAD_SOURCE_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={lead.status}
                            onChange={(e) =>
                              updateLead(lead, { status: e.target.value })
                            }
                            className="platform-select text-xs"
                          >
                            {statusChoices.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          {lead.paymentStatus && (
                            <PaymentStatusBadge status={lead.paymentStatus} />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {expanded ? (
                          <div className="space-y-2">
                            <textarea
                              value={notesDraft[key] ?? lead.followUpNotes ?? ""}
                              onChange={(e) =>
                                setNotesDraft((d) => ({ ...d, [key]: e.target.value }))
                              }
                              rows={3}
                              className="w-full min-w-[12rem] rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg)] p-2 text-xs text-[var(--platform-text)]"
                              placeholder="Follow-up notes…"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="platform-btn-primary h-7 px-2 text-xs"
                                onClick={() => {
                                  updateLead(lead, {
                                    follow_up_notes: notesDraft[key] ?? "",
                                  });
                                  setExpandedId(null);
                                }}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="platform-btn-ghost h-7 px-2 text-xs"
                                onClick={() => setExpandedId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedId(key);
                              setNotesDraft((d) => ({
                                ...d,
                                [key]: lead.followUpNotes ?? "",
                              }));
                            }}
                            className="text-left text-xs text-[var(--platform-accent)] hover:underline"
                          >
                            {lead.followUpNotes
                              ? lead.followUpNotes.slice(0, 40) + "…"
                              : "Add notes"}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {canMutate ? (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(lead)}
                          className="text-[var(--platform-text-secondary)] hover:text-[var(--platform-error)]"
                          aria-label={`Delete ${lead.name}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                        ) : null}
                        {lead.detailLink ? (
                          <div className="flex flex-col gap-1">
                            <Link
                              href={lead.detailLink}
                              className="inline-flex items-center gap-1 text-xs text-[var(--platform-accent)] hover:underline"
                            >
                              Open
                              <ExternalLink className="size-3" />
                            </Link>
                            <Link
                              href={
                                lead.email
                                  ? `/platform/messages?email=${encodeURIComponent(lead.email)}&name=${encodeURIComponent(lead.name)}`
                                  : "/platform/messages"
                              }
                              className="inline-flex items-center gap-1 text-xs text-[var(--platform-accent)] hover:underline"
                            >
                              <MessageSquare className="size-3" />
                              Message
                            </Link>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[var(--platform-border)] px-4 py-3 text-xs text-[var(--platform-text-secondary)]">
          {filtered.length} leads ·{" "}
          {leads.filter((l) =>
            l.type === "order"
              ? l.status === "pending"
              : l.status === "new" || l.status === "pending"
          ).length}{" "}
          open
          {(typeCounts.order ?? 0) > 0 ? ` · ${typeCounts.order} cart orders` : ""}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Move lead to trash?"
        description={
          deleteTarget
            ? `${deleteTarget.name}'s ${leadTypeLabel(deleteTarget.type).toLowerCase()} inquiry will be removed from Leads, but kept in Trash where it can be restored.`
            : ""
        }
        confirmLabel="Move to trash"
        destructive
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={async () => {
          if (deleteTarget) await deleteLeads([deleteTarget]);
        }}
      />

      <ConfirmDialog
        open={bulkDeleteConfirm}
        onOpenChange={(open) => {
          if (!open && !deleting) setBulkDeleteConfirm(false);
        }}
        title="Move selected leads to trash?"
        description={`Move ${selectedIds.size} lead${selectedIds.size === 1 ? "" : "s"} to trash? They will be removed from Leads but kept in Trash where they can be restored.`}
        confirmLabel="Move to trash"
        destructive
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={async () => {
          await deleteLeads(selectedLeads);
        }}
      />
    </div>
  );
}
