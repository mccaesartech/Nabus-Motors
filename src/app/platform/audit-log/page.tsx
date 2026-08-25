"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Search } from "lucide-react";
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

function actionLabel(action: string): string {
  return isAuditAction(action) ? AUDIT_ACTION_LABELS[action] : action;
}

export default function AuditLogPage() {
  const router = useRouter();
  const session = usePlatformSession();
  const canView =
    session?.role === "owner" || session?.role === "super_admin";

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

  if (session && !canView) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Immutable security and operations trail. Owner and Super Admin only — read-only."
      />

      {migrationRequired && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {message ||
            "Run supabase/migrations/093_audit_logs.sql in the Supabase SQL Editor to enable persistence."}
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
        </div>
      </div>

      <div
        ref={printRef}
        className="overflow-x-auto rounded-lg border border-[var(--platform-border)]"
      >
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--platform-bg-secondary)] text-[var(--platform-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Result</th>
              <th className="px-3 py-2 font-medium">Actor</th>
              <th className="px-3 py-2 font-medium">Target</th>
              <th className="px-3 py-2 font-medium">IP / Location</th>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Error</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[var(--platform-muted)]">
                  Loading audit events…
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[var(--platform-muted)]">
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
