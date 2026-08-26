"use client";

import { useMemo, useState } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { usePlatformSession } from "@/components/platform/platform-shell";
import { CurrencyCalculator } from "@/components/shared/currency-calculator";
import { usePlatformCurrency } from "@/context/platform-currency-context";
import { canViewFinance } from "@/lib/platform/permissions";
import {
  FX_ADMIN_OVERRIDE_LABEL,
  FX_MARKET_DISCLAIMER,
  formatUsdGhsRateLine,
  formatUpdatedAt,
  getActiveRates,
  rateSourceLabel,
} from "@/lib/currency";
import { cn } from "@/lib/utils";

export function CurrencyExchangePanel() {
  const session = usePlatformSession();
  const { currency, ratesLoaded, ratesStale, ratesMeta, refreshRates } = usePlatformCurrency();
  const canOverride = session ? canViewFinance(session.role) : false;
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState("");
  const [overrideRate, setOverrideRate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const effectiveGhs = getActiveRates().GHS ?? 0;
  const liveGhs = ratesMeta.displayOverride?.liveRate ?? effectiveGhs;
  const overrideActive = ratesMeta.displayOverride?.active === true;

  const liveSourceLabel = useMemo(
    () =>
      rateSourceLabel({
        source: "exchangerate-api",
        stale: ratesStale,
        providerName: "ExchangeRate-API",
      }),
    [ratesStale]
  );

  const displaySourceLabel = useMemo(
    () =>
      rateSourceLabel({
        source: ratesMeta.source,
        stale: ratesStale,
        isManual: overrideActive,
        isAdminDisplayOverride: overrideActive,
        providerName:
          ratesMeta.provider === "exchangerate-api" || !ratesMeta.provider
            ? "ExchangeRate-API"
            : ratesMeta.provider,
      }),
    [overrideActive, ratesMeta.provider, ratesMeta.source, ratesStale]
  );

  async function refreshRates() {
    setRefreshing(true);
    setToast("");
    try {
      const res = await fetch("/api/admin/exchange-rates/refresh", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setToast(json.message ?? "Could not refresh rates.");
        return;
      }
      setToast(json.stale ? "Live feed unavailable." : "Live rates synced.");
      await refreshRates();
    } catch {
      setToast("Could not refresh rates.");
    } finally {
      setRefreshing(false);
    }
  }

  async function submitPlatformOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!canOverride) return;
    setSaving(true);
    setToast("");
    try {
      const res = await fetch("/api/admin/exchange-rates/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "platform",
          action: "set",
          rateUsed: Number(overrideRate),
          reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setToast(json.message ?? "Could not save the manual rate.");
        return;
      }
      setToast(json.message ?? "Manual display rate saved.");
      await refreshRates();
    } catch {
      setToast("Could not save the manual rate.");
    } finally {
      setSaving(false);
    }
  }

  async function revertToLive() {
    if (!canOverride) return;
    setClearing(true);
    setToast("");
    try {
      const res = await fetch("/api/admin/exchange-rates/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "platform", action: "clear" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setToast(json.message ?? "Could not revert to live rate.");
        return;
      }
      setToast(json.message ?? "Reverted to live market rate.");
      await refreshRates();
    } catch {
      setToast("Could not revert to live rate.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-card)] p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--platform-text)]">
              {overrideActive ? "Rate in use on the site" : "Live rate"}
            </h2>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--platform-text)]">
              {formatUsdGhsRateLine(effectiveGhs)}
            </p>
            {overrideActive ? (
              <span className="mt-2 inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                {FX_ADMIN_OVERRIDE_LABEL}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={refreshRates}
            disabled={refreshing}
            className="platform-btn-ghost shrink-0"
            title="Force a live sync (rates also refresh automatically every 30 minutes)"
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            Sync now
          </button>
        </div>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--platform-text-secondary)]">Source</dt>
            <dd className="text-[var(--platform-text)]">{displaySourceLabel}</dd>
          </div>
          <div>
            <dt className="text-[var(--platform-text-secondary)]">Last updated</dt>
            <dd className="tabular-nums text-[var(--platform-text)]">
              {formatUpdatedAt(ratesMeta.fetchedAt ?? ratesMeta.rateDate)}
            </dd>
          </div>
          {overrideActive ? (
            <>
              <div>
                <dt className="text-[var(--platform-text-secondary)]">Live market rate</dt>
                <dd className="tabular-nums text-[var(--platform-text)]">
                  {formatUsdGhsRateLine(liveGhs)}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--platform-text-secondary)]">Live feed</dt>
                <dd className="text-[var(--platform-text)]">{liveSourceLabel}</dd>
              </div>
              {ratesMeta.displayOverride?.reason ? (
                <div className="sm:col-span-2">
                  <dt className="text-[var(--platform-text-secondary)]">Override reason</dt>
                  <dd className="text-[var(--platform-text)]">
                    {ratesMeta.displayOverride.reason}
                    {ratesMeta.displayOverride.setBy
                      ? ` · set by ${ratesMeta.displayOverride.setBy}`
                      : ""}
                  </dd>
                </div>
              ) : null}
            </>
          ) : null}
        </dl>
        <p className="mt-3 text-xs text-[var(--platform-text-secondary)]">
          Rates sync automatically from ExchangeRate-API about every 30 minutes.{" "}
          {FX_MARKET_DISCLAIMER}
        </p>
      </div>

      <CurrencyCalculator
        defaultFromCurrency="USD"
        defaultToCurrency={currency}
        ratesLoaded={ratesLoaded}
        ratesStale={ratesStale}
        ratesMeta={ratesMeta}
        variant="platform"
      />

      {canOverride ? (
        <div className="space-y-4 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-card)] p-4 sm:p-6">
          <div>
            <h2 className="text-base font-semibold text-[var(--platform-text)]">
              Set manual USD to GHS rate
            </h2>
            <p className="mt-0.5 text-sm text-[var(--platform-text-secondary)]">
              Overrides storefront prices. Live market rates keep syncing so you can revert anytime.
            </p>
          </div>

          {overrideActive ? (
            <button
              type="button"
              className="platform-btn-primary"
              onClick={revertToLive}
              disabled={clearing}
            >
              {clearing ? "Reverting..." : "Use live market rate"}
            </button>
          ) : null}

          <form onSubmit={submitPlatformOverride} className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-medium text-[var(--platform-text-secondary)]">
              GHS per 1 USD
              <input
                className="platform-input w-full"
                value={overrideRate}
                onChange={(e) => setOverrideRate(e.target.value)}
                inputMode="decimal"
                placeholder={String(liveGhs || effectiveGhs || "")}
                required
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-[var(--platform-text-secondary)]">
              Reason (audited)
              <input
                className="platform-input w-full"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Cross-check with bank rate for this week"
                required
                minLength={3}
              />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="platform-btn-primary" disabled={saving}>
                {saving ? "Saving..." : overrideActive ? "Update manual rate" : "Save manual rate"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <p className="flex items-start gap-2 text-sm text-[var(--platform-text-secondary)]">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          Manual display rates can only be changed by Owner and Super Admin.
        </p>
      )}

      {toast ? (
        <p className="text-sm text-[var(--platform-text)]" role="status">
          {toast}
        </p>
      ) : null}
    </div>
  );
}
