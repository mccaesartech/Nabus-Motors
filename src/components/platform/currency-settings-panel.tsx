"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { usePlatformSession } from "@/components/platform/platform-shell";
import { usePlatformCurrency } from "@/context/platform-currency-context";
import {
  FX_ADMIN_OVERRIDE_LABEL,
  FX_MARKET_DISCLAIMER,
  formatUpdatedAt,
  formatUsdGhsRateLine,
  rateSourceLabel,
} from "@/lib/currency";
import { canViewFinance } from "@/lib/platform/permissions";
import type { SiteSettingKey } from "@/lib/platform/modules";
import { cn } from "@/lib/utils";

type SettingsUpdater = (key: SiteSettingKey, value: string) => void;

type AdminRatesResponse = {
  ok?: boolean;
  message?: string;
  live?: {
    rates?: Record<string, number>;
    source?: string;
    stale?: boolean;
    fetchedAt?: string;
    rateDate?: string;
    provider?: string;
    error?: string;
  };
  effective?: {
    rates?: Record<string, number>;
    source?: string;
    stale?: boolean;
    fetchedAt?: string;
    provider?: string;
    displayOverride?: {
      active?: boolean;
      rateUsed?: number;
      liveRate?: number;
      reason?: string | null;
      setBy?: string | null;
      setAt?: string | null;
    } | null;
  };
  override?: {
    active?: boolean;
    rates?: Record<string, number>;
    reason?: string | null;
    setBy?: string | null;
    setAt?: string | null;
  };
};

type OverrideStatus = {
  active: boolean;
  useLiveRates?: boolean;
  rateUsed?: number | null;
  reason?: string | null;
  setBy?: string | null;
  setAt?: string | null;
};

type CurrencySettingsPanelProps = {
  settings: Record<string, string>;
  update: SettingsUpdater;
};

function syncParentFromOverride(update: SettingsUpdater, status: OverrideStatus) {
  if (status.useLiveRates || !status.active) {
    update("fx_use_live_rates", "true");
    update("fx_manual_rates_json", "{}");
    update("fx_manual_rate_reason", "");
    update("fx_manual_rate_set_by", "");
    update("fx_manual_rate_set_at", "");
    return;
  }

  const rate = status.rateUsed;
  update("fx_use_live_rates", "false");
  update(
    "fx_manual_rates_json",
    rate && rate > 0 ? JSON.stringify({ GHS: rate }) : "{}"
  );
  update("fx_manual_rate_reason", status.reason?.trim() ?? "");
  update("fx_manual_rate_set_by", status.setBy?.trim() ?? "");
  update("fx_manual_rate_set_at", status.setAt?.trim() ?? "");
}

export function CurrencySettingsPanel({ settings, update }: CurrencySettingsPanelProps) {
  const session = usePlatformSession();
  const { refreshRates: refreshPlatformRates } = usePlatformCurrency();
  const canOverride = session ? canViewFinance(session.role) : false;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [status, setStatus] = useState("");
  const [liveMeta, setLiveMeta] = useState<AdminRatesResponse["live"] | undefined>(
    undefined
  );
  const [overrideActive, setOverrideActive] = useState(false);
  const [overrideMeta, setOverrideMeta] = useState<{
    reason: string | null;
    setBy: string | null;
    setAt: string | null;
    rateUsed: number | null;
  }>({ reason: null, setBy: null, setAt: null, rateUsed: null });
  const [overrideRate, setOverrideRate] = useState(() => {
    try {
      const parsed = JSON.parse(settings.fx_manual_rates_json || "{}") as Record<
        string,
        unknown
      >;
      const ghs = Number(parsed.GHS);
      return Number.isFinite(ghs) && ghs > 0 ? String(ghs) : "";
    } catch {
      return "";
    }
  });
  const [reason, setReason] = useState(() => settings.fx_manual_rate_reason ?? "");

  const applyRatesPayload = useCallback((json: AdminRatesResponse) => {
    if (json.live) setLiveMeta(json.live);

    const active =
      json.override?.active === true ||
      json.effective?.displayOverride?.active === true;
    setOverrideActive(active);

    const rateUsed =
      json.override?.rates?.GHS ??
      json.effective?.displayOverride?.rateUsed ??
      null;
    const nextReason =
      json.override?.reason ?? json.effective?.displayOverride?.reason ?? null;
    const setBy =
      json.override?.setBy ?? json.effective?.displayOverride?.setBy ?? null;
    const setAt =
      json.override?.setAt ?? json.effective?.displayOverride?.setAt ?? null;

    setOverrideMeta({
      reason: nextReason,
      setBy,
      setAt,
      rateUsed: rateUsed && rateUsed > 0 ? rateUsed : null,
    });

    if (active && rateUsed && rateUsed > 0) {
      setOverrideRate(String(rateUsed));
    }
    if (nextReason) setReason(nextReason);
  }, []);

  const loadRates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/exchange-rates");
      const json = (await res.json()) as AdminRatesResponse;
      if (res.ok) applyRatesPayload(json);
      else setStatus(json.message ?? "Could not load live exchange rates.");
    } catch {
      setStatus("Could not load live exchange rates.");
    } finally {
      setLoading(false);
    }
  }, [applyRatesPayload]);

  useEffect(() => {
    void loadRates();
  }, [loadRates]);

  async function refreshLiveFeed() {
    setRefreshing(true);
    setStatus("");
    try {
      const res = await fetch("/api/admin/exchange-rates", { method: "POST" });
      const json = (await res.json()) as AdminRatesResponse;
      if (!res.ok) {
        setStatus(json.message ?? "Could not refresh rates.");
        return;
      }
      applyRatesPayload(json);
      await refreshPlatformRates();
      setStatus(
        json.live?.stale
          ? "Live feed unavailable — showing last-good or fallback rates."
          : "Rates refreshed from ExchangeRate-API."
      );
    } catch {
      setStatus("Could not refresh rates.");
    } finally {
      setRefreshing(false);
    }
  }

  async function saveManualRate() {
    if (!canOverride) return;
    setSaving(true);
    setStatus("");
    try {
      const res = await fetch("/api/admin/exchange-rates/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          scope: "platform",
          action: "set",
          rateUsed: Number(overrideRate),
          reason,
        }),
      });
      const json = (await res.json()) as AdminRatesResponse & {
        status?: OverrideStatus;
        message?: string;
      };
      if (!res.ok) {
        setStatus(json.message ?? "Could not save the manual rate.");
        return;
      }
      if (json.status) syncParentFromOverride(update, json.status);
      setOverrideActive(true);
      setOverrideMeta({
        reason: json.status?.reason ?? reason,
        setBy: json.status?.setBy ?? null,
        setAt: json.status?.setAt ?? null,
        rateUsed: json.status?.rateUsed ?? Number(overrideRate),
      });
      await refreshPlatformRates();
      await loadRates();
      setStatus(json.message ?? "Manual display rate saved.");
    } catch {
      setStatus("Could not save the manual rate.");
    } finally {
      setSaving(false);
    }
  }

  async function revertToLive() {
    if (!canOverride) return;
    setClearing(true);
    setStatus("");
    try {
      const res = await fetch("/api/admin/exchange-rates/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ scope: "platform", action: "clear" }),
      });
      const json = (await res.json()) as AdminRatesResponse & {
        status?: OverrideStatus;
        message?: string;
      };
      if (!res.ok) {
        setStatus(json.message ?? "Could not revert to live rate.");
        return;
      }
      if (json.status) syncParentFromOverride(update, json.status);
      else syncParentFromOverride(update, { active: false, useLiveRates: true });
      setOverrideActive(false);
      setOverrideMeta({ reason: null, setBy: null, setAt: null, rateUsed: null });
      setOverrideRate("");
      setReason("");
      await refreshPlatformRates();
      await loadRates();
      setStatus(json.message ?? "Storefront now uses the live market rate.");
    } catch {
      setStatus("Could not revert to live rate.");
    } finally {
      setClearing(false);
    }
  }

  const liveGhs = liveMeta?.rates?.GHS ?? 0;
  const effectiveGhs = overrideActive
    ? overrideMeta.rateUsed ?? liveGhs
    : liveGhs;

  const sourceLabel = rateSourceLabel({
    source: overrideActive ? "manual" : liveMeta?.source,
    stale: liveMeta?.stale,
    isManual: overrideActive,
    isAdminDisplayOverride: overrideActive,
    providerName:
      liveMeta?.provider === "exchangerate-api" || !liveMeta?.provider
        ? "ExchangeRate-API"
        : liveMeta?.provider,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-[var(--platform-text-secondary)]">
          Storefront prices convert from USD using live mid-market rates (refreshed about every 30
          minutes). Owner and Super Admin can optionally set a manual GHS display rate without
          stopping the live feed.
        </p>
        <button
          type="button"
          onClick={refreshLiveFeed}
          disabled={refreshing || loading}
          className="platform-btn-ghost shrink-0"
        >
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          Refresh live feed
        </button>
      </div>

      <dl className="grid gap-3 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg-secondary)] p-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--platform-text-secondary)]">
            {overrideActive ? "Rate in use on the site" : "Live market (1 USD)"}
          </dt>
          <dd className="mt-1 text-sm font-medium tabular-nums text-[var(--platform-text)]">
            {loading ? "Loading…" : formatUsdGhsRateLine(effectiveGhs)}
          </dd>
          {overrideActive ? (
            <dd className="mt-2">
              <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                {FX_ADMIN_OVERRIDE_LABEL}
              </span>
            </dd>
          ) : null}
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--platform-text-secondary)]">
            {overrideActive ? "Live market (1 USD)" : "Storefront display (1 USD)"}
          </dt>
          <dd className="mt-1 text-sm font-medium tabular-nums text-[var(--platform-text)]">
            {loading
              ? "Loading…"
              : formatUsdGhsRateLine(overrideActive ? liveGhs : effectiveGhs)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--platform-text-secondary)]">
            Source
          </dt>
          <dd className="mt-1 text-sm text-[var(--platform-text)]">{sourceLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--platform-text-secondary)]">
            Last updated
          </dt>
          <dd className="mt-1 text-sm tabular-nums text-[var(--platform-text)]">
            {formatUpdatedAt(
              overrideActive
                ? overrideMeta.setAt ?? liveMeta?.fetchedAt ?? liveMeta?.rateDate
                : liveMeta?.fetchedAt ?? liveMeta?.rateDate
            )}
          </dd>
        </div>
        {overrideActive && overrideMeta.reason ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--platform-text-secondary)]">
              Override reason
            </dt>
            <dd className="mt-1 text-sm text-[var(--platform-text)]">
              {overrideMeta.reason}
              {overrideMeta.setBy ? ` · set by ${overrideMeta.setBy}` : ""}
            </dd>
          </div>
        ) : null}
      </dl>

      <p className="text-xs text-[var(--platform-text-secondary)]">{FX_MARKET_DISCLAIMER}</p>

      {canOverride ? (
        <div className="space-y-3 border-t border-[var(--platform-border)] pt-4">
          <div>
            <p className="text-sm font-medium text-[var(--platform-text)]">
              Set manual USD → GHS rate
            </p>
            <p className="mt-0.5 text-xs text-[var(--platform-text-secondary)]">
              Saves immediately for storefront display. Live market rates keep syncing so you can
              revert anytime. Document snapshots stay frozen at their original rate.
            </p>
          </div>

          {overrideActive ? (
            <button
              type="button"
              className="platform-btn-primary"
              onClick={revertToLive}
              disabled={clearing || saving}
            >
              {clearing ? "Reverting…" : "Use live market rate"}
            </button>
          ) : null}

          {/* Buttons only — no nested <form> inside Settings #settings-form */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-medium text-[var(--platform-text-secondary)]">
              GHS per 1 USD
              <input
                className="platform-input w-full tabular-nums"
                value={overrideRate}
                onChange={(e) => setOverrideRate(e.target.value)}
                inputMode="decimal"
                placeholder={liveGhs > 0 ? String(liveGhs) : ""}
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-[var(--platform-text-secondary)]">
              Reason (audited)
              <input
                className="platform-input w-full"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Bank rate locked for weekend campaign"
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="button"
                className="platform-btn-primary"
                onClick={saveManualRate}
                disabled={saving || clearing}
              >
                {saving
                  ? "Saving…"
                  : overrideActive
                    ? "Update manual rate"
                    : "Save manual rate"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="flex items-start gap-2 text-sm text-[var(--platform-text-secondary)]">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          Manual display overrides are limited to Owner and Super Admin.
        </p>
      )}

      {status ? (
        <p className="text-sm text-[var(--platform-text)]" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
