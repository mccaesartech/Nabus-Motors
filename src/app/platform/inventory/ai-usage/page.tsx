"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { History, RefreshCw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/platform/page-header";
import {
  ConfirmDialog,
  DELETE_CONFIRM_PHRASE,
} from "@/components/platform/confirm-dialog";
import { PlatformDateTime } from "@/components/platform/platform-datetime";
import { usePlatformSession } from "@/components/platform/platform-shell";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import {
  AI_USAGE_ACTIONS,
  AI_USAGE_ACTION_LABELS,
  aiUsageActionLabel,
  type AiUsageLogRow,
} from "@/lib/ai/usage-log-shared";
import { canDirectMutate } from "@/lib/platform/mutation-approval";
import { platformPath } from "@/lib/platform/paths";
import { cn } from "@/lib/utils";

type AiUsageResponse = {
  ok: boolean;
  migrationRequired?: boolean;
  message?: string;
  logs?: AiUsageLogRow[];
  canPermanentlyDelete?: boolean;
};

function statusClass(status: string): string {
  if (status === "success") return "text-[var(--platform-success)]";
  if (status === "error") return "text-[var(--platform-danger)]";
  return "text-amber-600 dark:text-amber-400";
}

export default function InventoryAiUsagePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = usePlatformSession();
  const canEdit = session?.permissions.inventory_edit ?? false;
  const canPurge = session
    ? canDirectMutate(session.role) || session.role === "owner"
    : false;

  const initialVehicleId = searchParams.get("vehicleId")?.trim() ?? "";

  const [logs, setLogs] = useState<AiUsageLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [status, setStatus] = useState("");
  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [softConfirm, setSoftConfirm] = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ limit: "300" });
    if (q.trim()) params.set("q", q.trim());
    if (action) params.set("action", action);
    if (status) params.set("status", status);
    if (vehicleId.trim()) params.set("vehicleId", vehicleId.trim());

    const res = await fetch(`/api/admin/vehicles/ai-usage?${params.toString()}`);
    if (isAdminAuthError(res)) {
      router.push(adminLoginPath());
      return;
    }
    const json = (await res.json()) as AiUsageResponse;
    if (!res.ok || !json.ok) {
      setError(json.message ?? "Failed to load AI usage history");
      setLoading(false);
      return;
    }
    setLogs(json.logs ?? []);
    setMigrationRequired(Boolean(json.migrationRequired));
    setMessage(typeof json.message === "string" ? json.message : "");
    setSelected(new Set());
    setLoading(false);
  }, [router, q, action, status, vehicleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedIds = useMemo(() => [...selected], [selected]);

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(logs.map((row) => row.id)));
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function deleteSelected(mode: "soft" | "permanent") {
    if (!selectedIds.length) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/vehicles/ai-usage", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ids: selectedIds, mode }),
      });
      if (isAdminAuthError(res)) {
        router.push(adminLoginPath());
        return;
      }
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.message ?? "Could not delete AI history entries.");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <PageHeader
        title="AI usage history"
        description="Inventory AI Editor activity - chat, vision fills, image edits, and stock photo suggestions."
        breadcrumb="Inventory / AI usage"
        actions={
          <>
            <Link href={platformPath("inventory")} className="platform-btn-ghost">
              Back to inventory
            </Link>
            <button type="button" onClick={() => void load()} className="platform-btn-ghost">
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              Refresh
            </button>
          </>
        }
      />

      {migrationRequired && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {message ||
            "Run supabase/migrations/095_ai_usage_logs.sql in the Supabase SQL Editor to enable persisted AI history."}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[var(--platform-danger)]/30 bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[var(--platform-danger)]">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--platform-border)] bg-[var(--platform-bg-elevated)] p-4">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-[var(--platform-text-secondary)]">
          Search
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Actor, vehicle, snippet..."
            className="platform-input"
          />
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1 text-xs text-[var(--platform-text-secondary)]">
          Action
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="platform-input"
          >
            <option value="">All actions</option>
            {AI_USAGE_ACTIONS.map((key) => (
              <option key={key} value={key}>
                {AI_USAGE_ACTION_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[8rem] flex-col gap-1 text-xs text-[var(--platform-text-secondary)]">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="platform-input"
          >
            <option value="">All</option>
            <option value="success">Success</option>
            <option value="partial">Partial</option>
            <option value="error">Error</option>
          </select>
        </label>
        <label className="flex min-w-[12rem] flex-col gap-1 text-xs text-[var(--platform-text-secondary)]">
          Vehicle ID
          <input
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            placeholder="Filter by vehicle"
            className="platform-input"
          />
        </label>
      </div>

      {canEdit && selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--platform-text-secondary)]">
            {selectedIds.length} selected
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => setSoftConfirm(true)}
            className="platform-btn-ghost"
          >
            <Trash2 className="size-4" />
            Discard from history
          </button>
          {canPurge && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setPurgeConfirm(true)}
              className="platform-btn-ghost text-[var(--platform-danger)]"
            >
              <Trash2 className="size-4" />
              Permanently delete
            </button>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--platform-border)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[var(--platform-bg-secondary)] text-xs uppercase tracking-wide text-[var(--platform-text-secondary)]">
              <tr>
                {canEdit && (
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={logs.length > 0 && selected.size === logs.length}
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </th>
                )}
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Vehicle</th>
                <th className="px-3 py-2">Preview</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={canEdit ? 7 : 6}
                    className="px-4 py-8 text-center text-[var(--platform-text-secondary)]"
                  >
                    Loading AI usage...
                  </td>
                </tr>
              )}
              {!loading && logs.length === 0 && (
                <tr>
                  <td
                    colSpan={canEdit ? 7 : 6}
                    className="px-4 py-10 text-center text-[var(--platform-text-secondary)]"
                  >
                    <History className="mx-auto mb-2 size-6 opacity-50" />
                    No AI usage recorded yet. Use the AI Editor on a vehicle listing to populate
                    history.
                  </td>
                </tr>
              )}
              {!loading &&
                logs.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-[var(--platform-border)] align-top"
                  >
                    {canEdit && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.id}`}
                          checked={selected.has(row.id)}
                          onChange={(e) => toggleOne(row.id, e.target.checked)}
                        />
                      </td>
                    )}
                    <td className="whitespace-nowrap px-3 py-2 text-[var(--platform-text-secondary)]">
                      <PlatformDateTime value={row.created_at} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.actor_name ?? "-"}</div>
                      <div className="text-xs text-[var(--platform-text-secondary)]">
                        {row.actor_role ?? ""}
                      </div>
                    </td>
                    <td className="px-3 py-2">{aiUsageActionLabel(row.action)}</td>
                    <td className={cn("px-3 py-2 capitalize", statusClass(row.status))}>
                      {row.status}
                    </td>
                    <td className="px-3 py-2">
                      {row.vehicle_id ? (
                        <Link
                          href={platformPath(`inventory/${row.vehicle_id}/edit`)}
                          className="text-[var(--platform-accent)] hover:underline"
                        >
                          {row.vehicle_label || row.vehicle_slug || row.vehicle_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-[var(--platform-text-secondary)]">
                          {row.vehicle_label || "New / unsaved"}
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs px-3 py-2 text-[var(--platform-text-secondary)]">
                      <span className="line-clamp-2" title={row.preview_snippet ?? undefined}>
                        {row.preview_snippet || row.error_message || "-"}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {!canPurge && canEdit && (
        <p className="text-xs text-[var(--platform-text-secondary)]">
          You can discard entries from this view. Permanent purge requires Owner or Super Admin.
        </p>
      )}

      <ConfirmDialog
        open={softConfirm}
        onOpenChange={setSoftConfirm}
        title="Discard AI history?"
        description={`Hide ${selectedIds.length} entr${selectedIds.length === 1 ? "y" : "ies"} from the default AI usage history. This does not permanently purge the rows.`}
        confirmLabel="Discard"
        destructive
        onConfirm={() => deleteSelected("soft")}
      />

      <ConfirmDialog
        open={purgeConfirm}
        onOpenChange={setPurgeConfirm}
        title="Permanently delete AI history?"
        description={`Permanently delete ${selectedIds.length} entr${selectedIds.length === 1 ? "y" : "ies"}. This cannot be undone.`}
        confirmLabel="Delete permanently"
        confirmPhrase={DELETE_CONFIRM_PHRASE}
        destructive
        onConfirm={() => deleteSelected("permanent")}
      />
    </div>
  );
}