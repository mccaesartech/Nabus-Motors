"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, RotateCcw, Search } from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import { PlatformDateTime } from "@/components/platform/platform-datetime";
import { adminLoginPath } from "@/lib/admin/paths";
import {
  adminErrorMessage,
  isAdminAuthError,
  parseAdminResponse,
} from "@/lib/admin/client";
import { friendlyErrorMessage } from "@/lib/errors/client";
import {
  SEVERITY_LABELS,
  type PlatformErrorLogRow,
} from "@/lib/errors/error-log";
import { formatPlatformDateTime } from "@/lib/platform/datetime";
import { platformPath } from "@/lib/platform/paths";

const SEVERITY_TONE: Record<string, string> = {
  low: "bg-slate-500/10 text-slate-700",
  medium: "bg-amber-500/10 text-amber-800",
  high: "bg-orange-500/10 text-orange-800",
  critical: "bg-red-500/10 text-red-800",
};

type Filters = {
  q: string;
  severity: string;
  module: string;
  state: string;
  from: string;
  to: string;
};

const EMPTY_FILTERS: Filters = {
  q: "",
  severity: "",
  module: "",
  state: "unresolved",
  from: "",
  to: "",
};

function buildQuery(filters: Filters, extra: Record<string, string> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...extra })) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export default function ErrorLogPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<PlatformErrorLogRow[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Bumped whenever a mutation needs the current filters re-fetched.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(`/api/admin/error-log?${buildQuery(applied)}`);
        if (cancelled) return;

        if (isAdminAuthError(res)) {
          router.push(adminLoginPath());
          return;
        }
        if (res.status === 403) {
          router.push(platformPath("dashboard"));
          return;
        }

        const json = await parseAdminResponse(res);
        if (cancelled) return;

        if (json.ok === false) {
          setError(adminErrorMessage(json, "We could not load the error log."));
          return;
        }

        setError(null);
        setNotice(typeof json.message === "string" ? json.message : null);
        setRows((json.errors as PlatformErrorLogRow[] | undefined) ?? []);
        setModules((json.modules as string[] | undefined) ?? []);
      } catch (err) {
        if (!cancelled) setError(friendlyErrorMessage(err, "We could not load the error log."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applied, reloadToken, router]);

  const applyFilters = useCallback((next: Filters) => {
    setLoading(true);
    setApplied(next);
  }, []);

  const unresolvedCount = useMemo(
    () => rows.filter((row) => !row.resolved_at).length,
    [rows]
  );

  async function toggleResolved(row: PlatformErrorLogRow) {
    setBusyId(row.error_id);
    try {
      const res = await fetch("/api/admin/error-log", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ errorId: row.error_id, resolved: !row.resolved_at }),
      });
      const json = await parseAdminResponse(res);
      if (json.ok === false) {
        setError(adminErrorMessage(json, "That error could not be updated."));
        return;
      }
      setReloadToken((token) => token + 1);
    } catch (err) {
      setError(friendlyErrorMessage(err, "That error could not be updated."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Error log"
        description="Every handled failure across the platform, searchable by the TG- reference a user quotes to support."
        breadcrumb="Administration / Error log"
        backFallbackHref={platformPath("dashboard")}
        backLabel="Back to dashboard"
        actions={
          <a
            href={`/api/admin/error-log?${buildQuery(applied, { format: "csv" })}`}
            className="platform-btn-ghost"
          >
            <Download className="size-4" aria-hidden />
            Export CSV
          </a>
        }
      />

      {notice ? (
        <p className="platform-card rounded-xl px-4 py-3 text-sm text-[var(--platform-text-secondary)]">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="platform-card rounded-xl px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <form
        className="platform-card grid gap-3 rounded-xl p-4 sm:grid-cols-2 lg:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters(filters);
        }}
      >
        <label className="lg:col-span-2">
          <span className="mb-1 block text-xs font-medium text-[var(--platform-text-secondary)]">
            Search
          </span>
          <input
            className="platform-input w-full"
            placeholder="TG-7K3QP2, module, or message"
            value={filters.q}
            onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium text-[var(--platform-text-secondary)]">
            Severity
          </span>
          <select
            className="platform-select w-full"
            value={filters.severity}
            onChange={(event) => setFilters((prev) => ({ ...prev, severity: event.target.value }))}
          >
            <option value="">All</option>
            {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium text-[var(--platform-text-secondary)]">
            Module
          </span>
          <select
            className="platform-select w-full"
            value={filters.module}
            onChange={(event) => setFilters((prev) => ({ ...prev, module: event.target.value }))}
          >
            <option value="">All</option>
            {modules.map((module) => (
              <option key={module} value={module}>
                {module}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium text-[var(--platform-text-secondary)]">
            State
          </span>
          <select
            className="platform-select w-full"
            value={filters.state}
            onChange={(event) => setFilters((prev) => ({ ...prev, state: event.target.value }))}
          >
            <option value="">All</option>
            <option value="unresolved">Unresolved</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium text-[var(--platform-text-secondary)]">
            From
          </span>
          <input
            type="date"
            className="platform-input platform-input--date w-full"
            value={filters.from}
            onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium text-[var(--platform-text-secondary)]">
            To
          </span>
          <input
            type="date"
            className="platform-input platform-input--date w-full"
            value={filters.to}
            onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
          />
        </label>

        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
          <button type="submit" className="platform-btn-primary">
            <Search className="size-4" aria-hidden />
            Apply filters
          </button>
          <button
            type="button"
            className="platform-btn-ghost"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              applyFilters(EMPTY_FILTERS);
            }}
          >
            <RotateCcw className="size-4" aria-hidden />
            Reset
          </button>
          <p className="ml-auto self-center text-xs text-[var(--platform-text-secondary)]">
            {loading ? "Loading…" : `${rows.length} shown · ${unresolvedCount} unresolved`}
          </p>
        </div>
      </form>

      <div className="platform-card overflow-hidden rounded-xl">
        <div className="platform-table-scroll">
          <table className="platform-table w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-[var(--platform-text-secondary)]">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">Module</th>
                <th className="px-4 py-3 font-medium">Shown to user</th>
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-[var(--platform-text-secondary)]"
                  >
                    {loading ? "Loading errors…" : "No errors match these filters."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <PlatformDateTime
                        value={row.created_at}
                        mode="relative"
                        className="font-medium text-[var(--platform-text)]"
                      />
                      <div className="text-xs text-[var(--platform-text-secondary)]">
                        {formatPlatformDateTime(row.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((prev) => (prev === row.error_id ? null : row.error_id))
                        }
                        className="font-mono text-xs font-semibold text-[var(--platform-accent)] underline-offset-2 hover:underline"
                        aria-expanded={expanded === row.error_id}
                      >
                        {row.error_id}
                      </button>
                      {expanded === row.error_id ? (
                        <dl className="mt-2 space-y-1 text-xs text-[var(--platform-text-secondary)]">
                          <div>
                            <dt className="inline font-medium">Route: </dt>
                            <dd className="inline">
                              {row.method ?? "—"} {row.route ?? "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="inline font-medium">Detail: </dt>
                            <dd className="inline break-words">{row.internal_message ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="inline font-medium">DB code: </dt>
                            <dd className="inline">{row.db_code ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="inline font-medium">Client: </dt>
                            <dd className="inline">
                              {row.browser ?? "—"} on {row.os ?? "—"} · {row.actor_role ?? "guest"}
                            </dd>
                          </div>
                          <div>
                            <dt className="inline font-medium">Build: </dt>
                            <dd className="inline">
                              {row.environment ?? "—"} · {row.release ?? "—"}
                            </dd>
                          </div>
                        </dl>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`platform-badge ${SEVERITY_TONE[row.severity] ?? SEVERITY_TONE.high}`}
                      >
                        {SEVERITY_LABELS[row.severity] ?? row.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{row.module}</td>
                    <td className="px-4 py-3 text-[var(--platform-text-secondary)]">
                      {row.user_message ?? "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.resolved_at ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                          <CheckCircle2 className="size-3.5" aria-hidden />
                          Resolved
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--platform-text-secondary)]">Open</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={busyId === row.error_id}
                        onClick={() => void toggleResolved(row)}
                        className="platform-btn-ghost whitespace-nowrap"
                      >
                        {row.resolved_at ? "Reopen" : "Mark resolved"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
