"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ExternalLink, Inbox, Mail, Send, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import {
  ConfirmDialog,
  DELETE_CONFIRM_PHRASE,
} from "@/components/platform/confirm-dialog";
import { usePlatformSession } from "@/components/platform/platform-shell";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import type { ReceivedCommItem, SentEmailItem } from "@/lib/platform/emails";
import { cn } from "@/lib/utils";
import { RESEND_DOMAIN_SETUP_URL } from "@/lib/email/resend-constants";
import { PlatformDateTime } from "@/components/platform/platform-datetime";

type Tab = "sent" | "received";

function statusClass(status: string) {
  if (status === "sent") return "bg-emerald-100 text-emerald-900";
  if (status === "failed") return "bg-red-100 text-red-900";
  if (status === "deferred") return "bg-amber-100 text-amber-900";
  if (status === "skipped") return "bg-slate-100 text-slate-700";
  return "bg-violet-100 text-violet-900";
}

export default function PlatformEmailsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = usePlatformSession();
  const canDelete = Boolean(session?.permissions?.emails);
  const [tab, setTab] = useState<Tab>(
    () => (searchParams.get("tab") === "received" ? "received" : "sent")
  );
  const [loading, setLoading] = useState(true);
  const [sentItems, setSentItems] = useState<SentEmailItem[]>([]);
  const [receivedItems, setReceivedItems] = useState<ReceivedCommItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => Number(searchParams.get("page") ?? 1));
  const [templates, setTemplates] = useState<string[]>([]);
  const [failedCount, setFailedCount] = useState(0);
  const [inboundNote, setInboundNote] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => searchParams.get("id")
  );
  const [detail, setDetail] = useState<SentEmailItem | ReceivedCommItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState(
    () => searchParams.get("status") ?? "all"
  );
  const [templateFilter, setTemplateFilter] = useState(
    () => searchParams.get("template") ?? "all"
  );
  const [typeFilter, setTypeFilter] = useState(
    () => searchParams.get("type") ?? "all"
  );
  const [dateFrom, setDateFrom] = useState(() => searchParams.get("from") ?? "");
  const [dateTo, setDateTo] = useState(() => searchParams.get("to") ?? "");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);

  const limit = 50;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const loadList = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set("tab", tab);
    qs.set("page", String(page));
    qs.set("limit", String(limit));
    if (statusFilter !== "all" && tab === "sent") qs.set("status", statusFilter);
    if (templateFilter !== "all" && tab === "sent") qs.set("template", templateFilter);
    if (typeFilter !== "all" && tab === "received") qs.set("type", typeFilter);
    if (dateFrom) qs.set("from", new Date(dateFrom).toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      qs.set("to", end.toISOString());
    }

    const res = await fetch(`/api/admin/emails?${qs.toString()}`);
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = await res.json();
    if (tab === "sent") {
      setSentItems(json.items ?? []);
    } else {
      setReceivedItems(json.items ?? []);
      setInboundNote(json.inboundNote ?? null);
    }
    setTotal(json.total ?? 0);
    setTemplates(json.templates ?? []);
    setFailedCount(json.failedCount ?? 0);
    setLoading(false);
  }, [
    tab,
    page,
    statusFilter,
    templateFilter,
    typeFilter,
    dateFrom,
    dateTo,
    router,
  ]);

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      const qs = new URLSearchParams();
      qs.set("tab", tab);
      qs.set("id", id);
      const res = await fetch(`/api/admin/emails?${qs.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setDetail(json.items?.[0] ?? null);
      }
      setDetailLoading(false);
    },
    [tab]
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    } else {
      setDetail(null);
    }
  }, [selectedId, loadDetail]);

  useEffect(() => {
    const spTab = searchParams.get("tab");
    if (spTab === "received" || spTab === "sent") setTab(spTab);
  }, [searchParams]);

  const activeItems = tab === "sent" ? sentItems : receivedItems;

  const pageTitle = useMemo(
    () => (tab === "sent" ? "Sent emails" : "Customer messages & inquiries"),
    [tab]
  );

  function switchTab(next: Tab) {
    setTab(next);
    setPage(1);
    setSelectedId(null);
    setDetail(null);
  }

  function openRow(id: string) {
    setSelectedId(id);
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
  }

  async function deleteEmailRecords(ids: string[]) {
    if (ids.length === 0) return;
    setDeleting(true);
    setToastError(false);
    setToast(
      ids.length === 1 ? "Moving email record to trash…" : `Moving ${ids.length} records to trash…`
    );

    const res = await fetch("/api/admin/emails", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const json = await res.json().catch(() => ({}));
    setDeleting(false);
    setDeleteTargetId(null);
    setBulkDeleteConfirm(false);

    if (!res.ok) {
      setToastError(true);
      setToast(json.message ?? "Could not delete email record(s).");
      return;
    }

    const deleted = new Set<string>(
      Array.isArray(json.deletedIds) ? json.deletedIds.map(String) : ids
    );
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of deleted) next.delete(id);
      return next;
    });
    if (selectedId && deleted.has(selectedId)) {
      closeDetail();
    }
    if (tab === "sent") {
      setSentItems((prev) => prev.filter((row) => !deleted.has(row.id)));
    } else {
      setReceivedItems((prev) => prev.filter((row) => !deleted.has(row.id)));
    }
    setTotal((prev) => Math.max(0, prev - deleted.size));
    setToastError(Boolean(json.failed?.length));
    setToast(
      json.message ??
        (deleted.size === 1
          ? "Email record moved to trash."
          : `${deleted.size} records moved to trash.`)
    );
    await loadList();
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
    const visibleIds = activeItems.map((row) => row.id);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emails"
        description="Outbound delivery history and customer correspondence. Inbound email parsing is not configured — received items show contact forms and message threads."
        breadcrumb="Platform"
        actions={
          failedCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-900">
              <AlertCircle className="h-3.5 w-3.5" />
              {failedCount} failed / deferred
            </span>
          ) : undefined
        }
      />

      {toast && (
        <div
          role="status"
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            toastError
              ? "border-amber-500/40 bg-amber-500/10 text-[var(--platform-text)]"
              : "border-[var(--platform-success)]/30 bg-[rgba(16,185,129,0.08)] text-[var(--platform-success)]"
          )}
        >
          {toast}
        </div>
      )}

      {canDelete && selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--platform-border)] bg-white px-4 py-3">
          <span className="text-sm text-[var(--platform-text-secondary)]">
            {selectedCount} selected
          </span>
          <button
            type="button"
            className="platform-btn-ghost inline-flex items-center gap-1.5 text-sm text-red-700"
            onClick={() => setBulkDeleteConfirm(true)}
            disabled={deleting}
          >
            <Trash2 className="h-4 w-4" />
            Delete selected
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-[var(--platform-border)] bg-white p-1">
          <button
            type="button"
            onClick={() => switchTab("sent")}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition",
              tab === "sent"
                ? "bg-[var(--platform-accent)] text-white"
                : "text-[var(--platform-text-secondary)] hover:text-[var(--platform-text)]"
            )}
          >
            <Send className="h-4 w-4" />
            Sent
          </button>
          <button
            type="button"
            onClick={() => switchTab("received")}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition",
              tab === "received"
                ? "bg-[var(--platform-accent)] text-white"
                : "text-[var(--platform-text-secondary)] hover:text-[var(--platform-text)]"
            )}
          >
            <Inbox className="h-4 w-4" />
            Received
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="platform-input text-sm"
            aria-label="From date"
          />
          <span className="text-xs text-[var(--platform-text-secondary)]">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="platform-input text-sm"
            aria-label="To date"
          />
          {tab === "sent" ? (
            <>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="platform-input text-sm"
                aria-label="Status filter"
              >
                <option value="all">All statuses</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="deferred">Deferred</option>
                <option value="skipped">Skipped</option>
              </select>
              <select
                value={templateFilter}
                onChange={(e) => {
                  setTemplateFilter(e.target.value);
                  setPage(1);
                }}
                className="platform-input text-sm"
                aria-label="Template filter"
              >
                <option value="all">All templates</option>
                {templates.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="platform-input text-sm"
              aria-label="Type filter"
            >
              <option value="all">All types</option>
              <option value="contact">Contact form</option>
              <option value="vehicle_inquiry">Vehicle inquiry</option>
              <option value="customer_message">Customer message</option>
            </select>
          )}
        </div>
      </div>

      {tab === "received" && inboundNote && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <Mail className="mr-1.5 inline h-4 w-4" />
          {inboundNote}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="platform-card overflow-hidden rounded-xl">
          {canDelete && activeItems.length > 0 && (
            <div className="flex items-center justify-end border-b border-[var(--platform-border)] px-4 py-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--platform-text-secondary)]">
                <input
                  type="checkbox"
                  checked={
                    activeItems.length > 0 &&
                    activeItems.every((row) => selectedIds.has(row.id))
                  }
                  onChange={toggleSelectAllVisible}
                  className="size-3.5 rounded border-[var(--platform-border)]"
                  aria-label="Select all visible rows"
                />
                Select all
              </label>
            </div>
          )}
          {loading ? (
            <p className="px-5 py-12 text-center text-sm text-[var(--platform-text-secondary)]">
              Loading {pageTitle.toLowerCase()}…
            </p>
          ) : activeItems.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-[var(--platform-text-secondary)]">
              No {tab === "sent" ? "sent emails" : "received communications"} match your filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="platform-table w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--platform-border)] bg-[var(--platform-bg-secondary)]">
                    {canDelete && <th className="w-10 px-2 py-3" aria-label="Select" />}
                    <th className="px-4 py-3 font-medium">Date</th>
                    {tab === "sent" ? (
                      <>
                        <th className="px-4 py-3 font-medium">To</th>
                        <th className="px-4 py-3 font-medium">Subject / template</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Related</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 font-medium">From</th>
                        <th className="px-4 py-3 font-medium">Subject</th>
                        <th className="px-4 py-3 font-medium">Type</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {tab === "sent"
                    ? sentItems.map((row) => (
                        <tr
                          key={row.id}
                          onClick={() => openRow(row.id)}
                          className={cn(
                            "cursor-pointer border-b border-[var(--platform-border)] transition hover:bg-violet-50/60",
                            selectedId === row.id && "bg-violet-50"
                          )}
                        >
                          {canDelete && (
                            <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(row.id)}
                                onChange={() => toggleSelected(row.id)}
                                className="size-3.5 rounded border-[var(--platform-border)]"
                                aria-label={`Select ${row.subject}`}
                              />
                            </td>
                          )}
                          <td className="px-4 py-3 whitespace-nowrap text-[var(--platform-text-secondary)]">
                            <PlatformDateTime value={row.date} className="text-xs" />
                          </td>
                          <td className="px-4 py-3">{row.to}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{row.subject}</div>
                            <div className="text-xs text-[var(--platform-text-secondary)]">
                              {row.templateLabel}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                                statusClass(row.status)
                              )}
                            >
                              {row.status}
                            </span>
                            {row.failureHint ? (
                              <p className="mt-1 max-w-xs text-xs font-medium text-red-800 line-clamp-2">
                                {row.failureHint}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            {row.link ? (
                              <Link
                                href={row.link}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-[var(--platform-accent)] hover:underline"
                              >
                                {row.linkLabel}
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            ) : (
                              <span className="text-[var(--platform-text-secondary)]">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    : receivedItems.map((row) => (
                        <tr
                          key={row.id}
                          onClick={() => openRow(row.id)}
                          className={cn(
                            "cursor-pointer border-b border-[var(--platform-border)] transition hover:bg-violet-50/60",
                            selectedId === row.id && "bg-violet-50"
                          )}
                        >
                          {canDelete && (
                            <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(row.id)}
                                onChange={() => toggleSelected(row.id)}
                                className="size-3.5 rounded border-[var(--platform-border)]"
                                aria-label={`Select ${row.subject}`}
                              />
                            </td>
                          )}
                          <td className="px-4 py-3 whitespace-nowrap text-[var(--platform-text-secondary)]">
                            <PlatformDateTime value={row.date} className="text-xs" />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{row.fromName}</div>
                            <div className="text-xs text-[var(--platform-text-secondary)]">
                              {row.fromEmail}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{row.subject}</div>
                            <div className="line-clamp-1 text-xs text-[var(--platform-text-secondary)]">
                              {row.preview}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[var(--platform-text-secondary)]">
                            {row.typeLabel}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--platform-border)] px-4 py-3">
              <p className="text-xs text-[var(--platform-text-secondary)]">
                Page {page} of {totalPages} ({total} total)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="platform-btn-ghost text-xs disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="platform-btn-ghost text-xs disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="platform-card rounded-xl p-4 lg:sticky lg:top-4 lg:self-start">
          {!selectedId ? (
            <p className="text-sm text-[var(--platform-text-secondary)]">
              Select a row to view full details.
            </p>
          ) : detailLoading ? (
            <p className="text-sm text-[var(--platform-text-secondary)]">Loading detail…</p>
          ) : !detail ? (
            <p className="text-sm text-[var(--platform-text-secondary)]">Not found.</p>
          ) : tab === "sent" && "template" in detail ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold">Sent email</h2>
                <div className="flex items-center gap-1">
                  {canDelete && selectedId && (
                    <button
                      type="button"
                      onClick={() => setDeleteTargetId(selectedId)}
                      className="platform-btn-ghost inline-flex items-center gap-1 text-xs text-red-700"
                      disabled={deleting}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  )}
                  <button type="button" onClick={closeDetail} className="platform-btn-ghost text-xs">
                    Close
                  </button>
                </div>
              </div>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--platform-text-secondary)]">
                    Date
                  </dt>
                  <dd><PlatformDateTime value={detail.date} /></dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--platform-text-secondary)]">
                    To
                  </dt>
                  <dd>{detail.to}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--platform-text-secondary)]">
                    Template
                  </dt>
                  <dd>{detail.templateLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--platform-text-secondary)]">
                    Status
                  </dt>
                  <dd className="capitalize">{detail.status}</dd>
                </div>
                {(detail.status === "failed" || detail.status === "deferred") &&
                  "failureHint" in detail &&
                  detail.failureHint && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-red-900">
                        Why it failed
                      </dt>
                      <dd className="mt-1 text-sm text-red-900">{detail.failureHint}</dd>
                      <a
                        href={RESEND_DOMAIN_SETUP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-800 underline"
                      >
                        Resend domain setup
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                {detail.detail && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[var(--platform-text-secondary)]">
                      Delivery detail
                    </dt>
                    <dd className="whitespace-pre-wrap break-words text-[var(--platform-text-secondary)]">
                      {detail.detail}
                    </dd>
                  </div>
                )}
                {detail.sourceTable && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[var(--platform-text-secondary)]">
                      Source
                    </dt>
                    <dd>
                      {detail.sourceTable}
                      {detail.sourceId ? ` · ${detail.sourceId}` : ""}
                    </dd>
                  </div>
                )}
              </dl>
              {detail.link && (
                <Link href={detail.link} className="platform-btn-secondary inline-flex text-sm">
                  Open {detail.linkLabel}
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold">Received communication</h2>
                <div className="flex items-center gap-1">
                  {canDelete && selectedId && (
                    <button
                      type="button"
                      onClick={() => setDeleteTargetId(selectedId)}
                      className="platform-btn-ghost inline-flex items-center gap-1 text-xs text-red-700"
                      disabled={deleting}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  )}
                  <button type="button" onClick={closeDetail} className="platform-btn-ghost text-xs">
                    Close
                  </button>
                </div>
              </div>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--platform-text-secondary)]">
                    Date
                  </dt>
                  <dd><PlatformDateTime value={detail.date} /></dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--platform-text-secondary)]">
                    From
                  </dt>
                  <dd>
                    {"fromName" in detail ? detail.fromName : ""}
                    <br />
                    <span className="text-[var(--platform-text-secondary)]">
                      {"fromEmail" in detail ? detail.fromEmail : ""}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--platform-text-secondary)]">
                    Subject
                  </dt>
                  <dd>{"subject" in detail ? detail.subject : ""}</dd>
                </div>
                {"typeLabel" in detail && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[var(--platform-text-secondary)]">
                      Type
                    </dt>
                    <dd>{detail.typeLabel}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[var(--platform-text-secondary)]">
                    Message
                  </dt>
                  <dd className="whitespace-pre-wrap break-words rounded-lg bg-[var(--platform-bg-secondary)] p-3 text-[var(--platform-text-secondary)]">
                    {"body" in detail ? detail.body : ""}
                  </dd>
                </div>
              </dl>
              {"link" in detail && detail.link && (
                <Link href={detail.link} className="platform-btn-secondary inline-flex text-sm">
                  Open in platform
                </Link>
              )}
            </div>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
        title="Delete email record?"
        description="This moves the record to Trash. Owners can restore it from Platform → Trash."
        confirmLabel="Delete"
        destructive
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={() => {
          if (deleteTargetId) void deleteEmailRecords([deleteTargetId]);
        }}
      />

      <ConfirmDialog
        open={bulkDeleteConfirm}
        onOpenChange={setBulkDeleteConfirm}
        title={`Delete ${selectedCount} record${selectedCount === 1 ? "" : "s"}?`}
        description="Selected email records will be moved to Trash. Owners can restore them from Platform → Trash."
        confirmLabel="Delete selected"
        destructive
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={() => void deleteEmailRecords(Array.from(selectedIds))}
      />
    </div>
  );
}
