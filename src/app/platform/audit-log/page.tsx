"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Search, Trash2 } from "lucide-react";
import {
  ConfirmDialog,
  DELETE_CONFIRM_PHRASE,
} from "@/components/platform/confirm-dialog";
import { PageHeader } from "@/components/platform/page-header";
import { PlatformDateTime } from "@/components/platform/platform-datetime";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { usePlatformSession } from "@/components/platform/platform-shell";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTIONS,
  isAuditAction,
} from "@/lib/audit/actions";
import { formatAuditLocation, type AuditLogRow } from "@/lib/audit/types";
import { cn } from "@/lib/utils";

function actionLabel(action: string): string {
  return isAuditAction(action) ? AUDIT_ACTION_LABELS[action] : action;
}

export default function AuditLogPage() {
  const router = useRouter();
  const session = usePlatformSession();
  const canView =
    session?.role === "owner" || session?.role === "super_admin";
  const canDelete = canView;

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [message, setMessage] = useState("");
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [success, setSuccess] = useState("");
  const [actor, setActor] = useState("");
  const [targetType, setTargetType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState<AuditLogRow | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }

    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (action) params.set("action", action);
    if (success) params.set("success", success);
    if (actor.trim()) params.set("actor", actor.trim());
    if (targetType.trim()) params.set("targetType", targetType.trim());
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    params.set("limit", "300");

    const res = await fetch(`/api/admin/audit-log?${params.toString()}`);
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    if (res.status === 403) {
      router.push("/platform/dashboard");
      return;
    }

    const json = await res.json();
    setLogs(json.logs ?? []);
    setMigrationRequired(Boolean(json.migrationRequired));
    setMessage(typeof json.message === "string" ? json.message : "");
    setSelectedIds(new Set());
    setLoading(false);
  }, [router, canView, q, action, success, actor, targetType, dateFrom, dateTo]);

  useEffect(() => {
    if (session && !canView) {
      router.push("/platform/dashboard");
      return;
    }
    load();
  }, [load, session, canView, router]);

  const targetTypes = useMemo(
    () =>
      [...new Set(logs.map((row) => row.target_type).filter(Boolean) as string[])].sort(),
    [logs]
  );

  const allVisibleSelected =
    logs.length > 0 && logs.every((row) => selectedIds.has(row.id));

  function exportUrl(format: "csv" | "xlsx" | "html") {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (action) params.set("action", action);
    if (success) params.set("success", success);
    if (actor.trim()) params.set("actor", actor.trim());
    if (targetType.trim()) params.set("targetType", targetType.trim());
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    params.set("format", format);
    return `/api/admin/audit-log?${params.toString()}`;
  }

  async function downloadPdf() {
    const res = await fetch(exportUrl("html"));
    if (!res.ok) return;
    const html = await res.text();
    const container = document.createElement("div");
    container.innerHTML = html;
    container.style.position = "fixed";
    container.style.left = "-9999px";
    document.body.appendChild(container);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf()
        .set({
          margin: 10,
          filename: `true-goshen-audit-log-${new Date().toISOString().slice(0, 10)}.pdf`,
          html2canvas: { scale: 1.2 },
          jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        })
        .from(container)
        .save();
    } finally {
      document.body.removeChild(container);
    }
  }

  async function deleteAuditLogs(targets: AuditLogRow[]) {
    if (targets.length === 0 || !canDelete) return;

    const ids = targets.map((row) => row.id);
    const snapshots: Record<string, Record<string, unknown>> = {};
    for (const row of targets) {
      snapshots[row.id] = { ...row };
    }

    const snapshotLogs = logs;
    const idSet = new Set(ids);

    setDeleteTarget(null);
    setBulkDeleteConfirm(false);
    setLogs((prev) => prev.filter((row) => !idSet.has(row.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    setDeleting(true);
    setToastError(false);
    setToast(
      ids.length === 1
        ? "Moving audit log entry to trash…"
        : `Moving ${ids.length} audit log entries to trash…`
    );

    try {
      const res = await fetch("/api/admin/audit-log", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, snapshots }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setLogs(snapshotLogs);
        setToastError(true);
        setToast(json.message ?? "Could not delete audit log entry.");
        return;
      }

      const deleted = (
        Array.isArray(json.deletedIds) ? json.deletedIds.map(String) : ids
      ) as string[];
      const deletedSet = new Set(deleted);
      const failedRollback = targets.filter((row) => !deletedSet.has(row.id));
      if (failedRollback.length > 0) {
        setLogs((prev) => {
          const existing = new Set(prev.map((row) => row.id));
          const restored = failedRollback.filter((row) => !existing.has(row.id));
          return [...restored, ...prev].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        });
      }

      setToastError(Boolean(json.failed?.length));
      setToast(
        json.message ??
          (deleted.length === 1
            ? "Audit log entry moved to trash."
            : `${deleted.length} audit log entries moved to trash.`)
      );
    } catch {
      setLogs(snapshotLogs);
      setToastError(true);
      setToast("Could not delete audit log entry.");
    } finally {
      setDeleting(false);
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
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(logs.map((row) => row.id)));
  }

  const selectedTargets = logs.filter((row) => selectedIds.has(row.id));

  if (session && !canView) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Security and operations trail. Owner and Super Admin only. Entries can be moved to Trash; restore or permanently delete from there."
      />

      {migrationRequired && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {message ||
            "Run supabase/migrations/093_audit_logs.sql in the Supabase SQL Editor to enable persistence."}
        </div>
      )}

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

      <div className="flex flex-col gap-3 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg-secondary)] p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--platform-muted)]">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-[var(--platform-muted)]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Action, actor, IP, target…"
                className="w-full rounded-md border border-[var(--platform-border)] bg-[var(--platform-bg)] py-2 pl-8 pr-3 text-sm"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--platform-muted)]">Action</span>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="rounded-md border border-[var(--platform-border)] bg-[var(--platform-bg)] px-3 py-2 text-sm"
            >
              <option value="">All actions</option>
              {AUDIT_ACTIONS.map((code) => (
                <option key={code} value={code}>
                  {AUDIT_ACTION_LABELS[code]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--platform-muted)]">Result</span>
            <select
              value={success}
              onChange={(e) => setSuccess(e.target.value)}
              className="rounded-md border border-[var(--platform-border)] bg-[var(--platform-bg)] px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="true">Success</option>
              <option value="false">Failed</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--platform-muted)]">Actor</span>
            <input
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              placeholder="Name, role, or id"
              className="rounded-md border border-[var(--platform-border)] bg-[var(--platform-bg)] px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--platform-muted)]">Target type</span>
            <input
              list="audit-target-types"
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              placeholder="e.g. vehicle, user"
              className="rounded-md border border-[var(--platform-border)] bg-[var(--platform-bg)] px-3 py-2 text-sm"
            />
            <datalist id="audit-target-types">
              {targetTypes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--platform-muted)]">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-md border border-[var(--platform-border)] bg-[var(--platform-bg)] px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--platform-muted)]">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-md border border-[var(--platform-border)] bg-[var(--platform-bg)] px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              load();
            }}
            className="rounded-md bg-[var(--platform-accent)] px-3 py-2 text-sm font-medium text-white"
          >
            Apply filters
          </button>
          <a
            href={exportUrl("csv")}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--platform-border)] px-3 py-2 text-sm"
          >
            <Download className="h-4 w-4" /> CSV
          </a>
          <a
            href={exportUrl("xlsx")}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--platform-border)] px-3 py-2 text-sm"
            title="CSV formatted for Excel"
          >
            <Download className="h-4 w-4" /> Excel
          </a>
          <button
            type="button"
            onClick={() => void downloadPdf()}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--platform-border)] px-3 py-2 text-sm"
          >
            <FileText className="h-4 w-4" /> PDF
          </button>
          {canDelete && selectedIds.size > 0 && (
            <button
              type="button"
              disabled={deleting}
              onClick={() => setBulkDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-900"
            >
              <Trash2 className="h-4 w-4" />
              Delete selected ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      <div
        ref={printRef}
        className="overflow-x-auto rounded-lg border border-[var(--platform-border)]"
      >
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--platform-bg-secondary)] text-[var(--platform-muted)]">
            <tr>
              {canDelete && (
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all visible audit log entries"
                    checked={allVisibleSelected && logs.length > 0}
                    onChange={toggleSelectAllVisible}
                    disabled={loading || logs.length === 0}
                  />
                </th>
              )}
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Result</th>
              <th className="px-3 py-2 font-medium">Actor</th>
              <th className="px-3 py-2 font-medium">Target</th>
              <th className="px-3 py-2 font-medium">IP / Location</th>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Error</th>
              {canDelete && <th className="px-3 py-2 font-medium"> </th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={canDelete ? 10 : 8}
                  className="px-3 py-8 text-center text-[var(--platform-muted)]"
                >
                  Loading audit events…
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td
                  colSpan={canDelete ? 10 : 8}
                  className="px-3 py-8 text-center text-[var(--platform-muted)]"
                >
                  No audit events match these filters.
                </td>
              </tr>
            ) : (
              logs.map((row) => (
                <tr
                  key={row.id}
                  className={
                    row.success
                      ? "border-t border-[var(--platform-border)]"
                      : "border-t border-red-200 bg-red-50/80 text-red-950"
                  }
                >
                  {canDelete && (
                    <td className="px-3 py-2 align-top">
                      <input
                        type="checkbox"
                        aria-label={`Select audit log entry ${actionLabel(row.action)}`}
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelected(row.id)}
                      />
                    </td>
                  )}
                  <td className="whitespace-nowrap px-3 py-2 align-top">
                    <PlatformDateTime value={row.timestamp} />
                  </td>
                  <td className="px-3 py-2 align-top font-medium">{actionLabel(row.action)}</td>
                  <td className="px-3 py-2 align-top">
                    {row.success ? (
                      <span className="text-emerald-700">Success</span>
                    ) : (
                      <span className="font-semibold text-red-700">Failed</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div>{row.actor_name ?? "—"}</div>
                    <div className="text-xs text-[var(--platform-muted)]">
                      {row.actor_role ?? "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div>{row.target_name ?? row.target_id ?? "—"}</div>
                    <div className="text-xs text-[var(--platform-muted)]">
                      {row.target_type ?? ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-mono text-xs">{row.ip_address ?? "—"}</div>
                    <div className="text-xs text-[var(--platform-muted)]">
                      {formatAuditLocation(row)}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-[var(--platform-muted)]">
                    {[row.browser, row.operating_system].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="max-w-xs px-3 py-2 align-top text-xs">
                    {row.error_message ?? ""}
                  </td>
                  {canDelete && (
                    <td className="px-3 py-2 align-top">
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => setDeleteTarget(row)}
                        className="rounded-md p-1.5 text-[var(--platform-muted)] hover:bg-red-50 hover:text-red-700"
                        aria-label="Move audit log entry to trash"
                        title="Move to trash"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Move audit log entry to trash?"
        description="The entry will be removed from this list and moved to Trash. You can restore it from Trash or permanently delete it there (Owner / Super Admin only)."
        confirmLabel="Move to trash"
        busyLabel="Moving to trash…"
        destructive
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={() => {
          if (deleteTarget) void deleteAuditLogs([deleteTarget]);
        }}
      />

      <ConfirmDialog
        open={bulkDeleteConfirm}
        onOpenChange={setBulkDeleteConfirm}
        title={`Move ${selectedTargets.length} audit log entries to trash?`}
        description="Selected entries will be removed from this list and moved to Trash. You can restore or permanently delete them from Trash."
        confirmLabel="Move to trash"
        busyLabel="Moving to trash…"
        destructive
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        onConfirm={() => void deleteAuditLogs(selectedTargets)}
      />
    </div>
  );
}
