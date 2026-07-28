"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Download, RefreshCw } from "lucide-react";
import { PageHeader, StatCard } from "@/components/platform/page-header";
import { PlatformDateTime } from "@/components/platform/platform-datetime";
import { adminLoginPath } from "@/lib/admin/paths";
import { isAdminAuthError } from "@/lib/admin/client";
import { downloadCsv } from "@/lib/platform/data";
import {
  assetTypeLabel,
  directionLabel,
  movementTypeLabel,
} from "@/lib/platform/inventory-movements/labels";
import type {
  InventoryMovementRow,
  MovementAssetType,
  MovementBucket,
  MovementPeriod,
  MovementSummary,
} from "@/lib/platform/inventory-movements/types";
import { platformPath } from "@/lib/platform/paths";
import { usePlatformCurrency } from "@/context/platform-currency-context";
import { cn } from "@/lib/utils";

type MovementsResponse = {
  ok: boolean;
  configured?: boolean;
  migrationRequired?: boolean;
  message?: string;
  movements?: Array<InventoryMovementRow & { runningNetUsd: number }>;
  summary?: MovementSummary;
  buckets?: MovementBucket[];
  period?: MovementPeriod;
  range?: { from: string; to: string };
  needsBackfill?: boolean;
  totalRecords?: number;
};

const PERIOD_OPTIONS: { value: MovementPeriod; label: string }[] = [
  { value: "day", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "range", label: "Custom range" },
];

const ASSET_FILTERS: { value: MovementAssetType | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "vehicle", label: "Vehicles" },
  { value: "part", label: "Parts" },
  { value: "sale", label: "Sales" },
  { value: "order", label: "Orders" },
  { value: "preorder", label: "Pre-orders" },
  { value: "expense", label: "Expenses" },
];

export default function InventoryMovementsPage() {
  const router = useRouter();
  const { formatPrice } = usePlatformCurrency();
  const [period, setPeriod] = useState<MovementPeriod>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [assetType, setAssetType] = useState<MovementAssetType | "all">("all");
  const [direction, setDirection] = useState<"all" | "in" | "out">("all");
  const [movements, setMovements] = useState<
    Array<InventoryMovementRow & { runningNetUsd: number }>
  >([]);
  const [summary, setSummary] = useState<MovementSummary | null>(null);
  const [buckets, setBuckets] = useState<MovementBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState(false);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [needsBackfill, setNeedsBackfill] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (opts?: { backfill?: boolean }) => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ period });
      if (period === "range") {
        if (from) params.set("from", from);
        if (to) params.set("to", to);
      }
      if (assetType !== "all") params.set("asset_type", assetType);
      if (direction !== "all") params.set("direction", direction);
      if (opts?.backfill) params.set("backfill", "1");

      const res = await fetch(`/api/admin/inventory-movements?${params.toString()}`);
      if (isAdminAuthError(res)) {
        router.push(adminLoginPath());
        return;
      }

      const json = (await res.json()) as MovementsResponse;
      if (!res.ok || !json.ok) {
        setError(json.message ?? "Failed to load movement records");
        setLoading(false);
        return;
      }

      setMigrationRequired(Boolean(json.migrationRequired));
      setNeedsBackfill(Boolean(json.needsBackfill));
      setMovements(json.movements ?? []);
      setSummary(json.summary ?? null);
      setBuckets(json.buckets ?? []);
      setLoading(false);
    },
    [period, from, to, assetType, direction, router]
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function handleBackfill() {
    setBackfilling(true);
    await load({ backfill: true });
    setBackfilling(false);
  }

  function exportCsv() {
    const headers = [
      "occurred_at",
      "direction",
      "asset_type",
      "movement_type",
      "description",
      "quantity",
      "amount_usd",
      "running_net_usd",
    ];
    const lines = [
      headers.join(","),
      ...movements.map((row) =>
        [
          row.occurred_at,
          row.direction,
          row.asset_type,
          row.movement_type,
          `"${row.description.replace(/"/g, '""')}"`,
          row.quantity,
          row.amount_usd,
          row.runningNetUsd,
        ].join(",")
      ),
    ];
    downloadCsv(`inventory-movements-${period}.csv`, lines.join("\n"));
  }

  const periodLabel = useMemo(
    () => PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? period,
    [period]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movement Ledger"
        description="Trace vehicles, parts, sales revenue, and expenses — daily, weekly, monthly, or yearly."
        breadcrumb="INVENTORY · Movement Ledger"
        actions={
          <>
            <Link href={platformPath("inventory")} className="platform-btn-ghost">
              Inventory list
            </Link>
            <button
              type="button"
              className="platform-btn-ghost"
              onClick={() => load()}
              disabled={loading}
            >
              <RefreshCw className="size-4" />
              Refresh
            </button>
            <button
              type="button"
              className="platform-btn-primary"
              onClick={exportCsv}
              disabled={!movements.length}
            >
              <Download className="size-4" />
              Export CSV
            </button>
          </>
        }
      />

      {migrationRequired ? (
        <div className="rounded-xl border border-[var(--platform-border)] bg-[var(--platform-surface)] px-4 py-3 text-sm text-[var(--platform-text-secondary)]">
          Movement history is temporarily unavailable. Records will appear here once setup is
          complete — no action needed on this page.
        </div>
      ) : null}

      {needsBackfill && !migrationRequired ? (
        <div className="platform-card flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--platform-text)]">
              Import historical records
            </p>
            <p className="mt-1 text-sm text-[var(--platform-text-secondary)]">
              Backfill from existing vehicles, sales, expenses, pre-orders, and confirmed orders.
            </p>
          </div>
          <button
            type="button"
            className="platform-btn-primary shrink-0"
            onClick={handleBackfill}
            disabled={backfilling}
          >
            {backfilling ? "Importing…" : "Import history"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="platform-card rounded-xl p-5">
        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                period === option.value
                  ? "border-[var(--platform-accent)] bg-[rgba(37,99,235,0.12)] text-[var(--platform-text)]"
                  : "border-[var(--platform-border)] text-[var(--platform-text-secondary)] hover:text-[var(--platform-text)]"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {period === "range" ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:max-w-md">
            <label className="block space-y-1.5">
              <span className="text-xs text-[var(--platform-text-secondary)]">From</span>
              <input
                type="date"
                className="platform-input platform-input--date w-full"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-[var(--platform-text-secondary)]">To</span>
              <input
                type="date"
                className="platform-input platform-input--date w-full"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3">
          <select
            className="platform-input"
            value={assetType}
            onChange={(e) => setAssetType(e.target.value as MovementAssetType | "all")}
          >
            {ASSET_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
          <select
            className="platform-input"
            value={direction}
            onChange={(e) => setDirection(e.target.value as "all" | "in" | "out")}
          >
            <option value="all">All directions</option>
            <option value="in">In only</option>
            <option value="out">Out only</option>
          </select>
        </div>
      </div>

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={`Money in (${periodLabel})`}
            value={formatPrice(summary.totalInUsd)}
            icon={<ArrowDownLeft className="size-4" />}
            changeTone="positive"
          />
          <StatCard
            label={`Money out (${periodLabel})`}
            value={formatPrice(summary.totalOutUsd)}
            icon={<ArrowUpRight className="size-4" />}
            changeTone="negative"
          />
          <StatCard
            label="Net"
            value={formatPrice(summary.netUsd)}
            change={`${summary.count} record${summary.count === 1 ? "" : "s"}`}
            changeTone={summary.netUsd >= 0 ? "positive" : "negative"}
          />
          <StatCard
            label="Units in / out"
            value={`${summary.unitsIn} / ${summary.unitsOut}`}
            change="Inventory quantity"
            changeTone="neutral"
          />
        </div>
      ) : null}

      {buckets.length > 0 && period !== "day" ? (
        <div className="platform-card overflow-hidden rounded-xl">
          <div className="border-b border-[var(--platform-border)] px-4 py-3">
            <h2 className="text-sm font-semibold text-[var(--platform-text)]">
              Period breakdown
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="platform-table w-full min-w-[640px]">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>In</th>
                  <th>Out</th>
                  <th>Net</th>
                  <th>Records</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((bucket) => (
                  <tr key={bucket.bucketKey}>
                    <td>{bucket.bucketLabel}</td>
                    <td className="tabular-nums text-[var(--platform-success)]">
                      {formatPrice(bucket.totalInUsd)}
                    </td>
                    <td className="tabular-nums text-[var(--platform-error)]">
                      {formatPrice(bucket.totalOutUsd)}
                    </td>
                    <td className="tabular-nums">{formatPrice(bucket.netUsd)}</td>
                    <td>{bucket.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="platform-card overflow-hidden rounded-xl">
        <div className="border-b border-[var(--platform-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--platform-text)]">Movement log</h2>
          <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
            Chronological record of what entered and left the business.
          </p>
        </div>

        {loading ? (
          <p className="px-4 py-8 text-sm text-[var(--platform-text-secondary)]">Loading…</p>
        ) : movements.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[var(--platform-text-secondary)]">
            No movements in this period. New vehicles, sales, parts changes, expenses, and confirmed
            orders will appear here automatically.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="platform-table w-full min-w-[900px]">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Direction</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Amount</th>
                  <th>Running net</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap text-xs">
                      <PlatformDateTime value={row.occurred_at} />
                    </td>
                    <td>
                      <span
                        className={
                          row.direction === "in"
                            ? "text-[var(--platform-success)]"
                            : "text-[var(--platform-error)]"
                        }
                      >
                        {directionLabel(row.direction)}
                      </span>
                    </td>
                    <td className="text-xs">
                      <span className="block">{assetTypeLabel(row.asset_type)}</span>
                      <span className="text-[var(--platform-text-secondary)]">
                        {movementTypeLabel(row.movement_type)}
                      </span>
                    </td>
                    <td className="max-w-xs truncate" title={row.description}>
                      {row.description}
                    </td>
                    <td className="tabular-nums">{row.quantity || "—"}</td>
                    <td className="tabular-nums">{formatPrice(row.amount_usd)}</td>
                    <td className="tabular-nums">{formatPrice(row.runningNetUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
