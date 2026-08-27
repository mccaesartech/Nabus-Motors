"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { usePlatformSession } from "@/components/platform/platform-shell";
import {
  FX_MARKET_DISCLAIMER,
  FX_MANUAL_LABEL,
  formatUpdatedAt,
  formatUsdGhsRateLine,
  rateSourceLabel,
} from "@/lib/currency";
import {
  FX_OVERRIDE_CURRENCIES,
  parseManualRatesJson,
} from "@/lib/currency/rates";
import { getCurrencyLabel } from "@/lib/currency/names";
import type { SiteSettingKey } from "@/lib/platform/modules";
import { canViewFinance } from "@/lib/platform/permissions";
import { cn } from "@/lib/utils";

type SettingsUpdater = (key: SiteSettingKey, value: string) => void;

type AdminRatesResponse = {
  ok?: boolean;
  live?: {
    rates?: Record<string, number>;
    source?: string;
    stale?: boolean;
    fetchedAt?: string;
    rateDate?: string;
    provider?: string;
    error?: string;
  };
};

type CurrencySettingsPanelProps = {
  settings: Record<string, string>;
  update: SettingsUpdater;
  updateBool: (key: SiteSettingKey, value: boolean) => void;
  isOn: (key: SiteSettingKey) => boolean;
};

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-start justify-between gap-4 rounded-lg border border-[var(--platform-border)] px-4 py-3",
        disabled ? "opacity-60" : "cursor-pointer"
      )}
    >
      <span>
        <span className="block text-sm font-medium text-[var(--platform-text)]">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-[var(--platform-text-secondary)]">
            {description}
          </span>
        ) : null}
      </span>
      <input
        type="checkbox"
        className="mt-1 size-4 rounded border-[var(--platform-border)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function CurrencySettingsPanel({
  settings,
  update,
  updateBool,
  isOn,
}: CurrencySettingsPanelProps) {
  const session = usePlatformSession();
  const canOverride = session ? canViewFinance(session.role) : false;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveMeta, setLiveMeta] = useState<AdminRatesResponse["live"] | undefined>(
    undefined
  );
  const [status, setStatus] = useState("");

  const manualRates = useMemo(
    () => parseManualRatesJson(settings.fx_manual_rates_json),
    [settings.fx_manual_rates_json]
  );

  const loadRates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/exchange-rates");
      const json = (await res.json()) as AdminRatesResponse;
      if (res.ok && json.live) setLiveMeta(json.live);
    } catch {
      setStatus("Could not load live exchange rates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  async function refreshRates() {
    setRefreshing(true);
    setStatus("");
    try {
      const res = await fetch("/api/admin/exchange-rates", { method: "POST" });
      const json = (await res.json()) as AdminRatesResponse;
      if (!res.ok) {
        setStatus("Could not refresh rates.");
        return;
      }
      if (json.live) setLiveMeta(json.live);
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

  function setManualRate(code: string, value: string) {
    const next = { ...manualRates };
    const parsed = Number(value);
    if (value.trim() === "") delete next[code];
    else if (Number.isFinite(parsed) && parsed > 0) next[code] = parsed;
    else return;
    update("fx_manual_rates_json", JSON.stringify(next));
  }

  const useLiveRates = isOn("fx_use_live_rates");
  const liveGhs = liveMeta?.rates?.GHS ?? 0;
  const effectiveGhs = useLiveRates ? liveGhs : manualRates.GHS ?? liveGhs;

  const sourceLabel = rateSourceLabel({
    source: useLiveRates ? liveMeta?.source : "manual",
    stale: liveMeta?.stale,
    isManual: !useLiveRates,
    providerName:
      liveMeta?.provider === "exchangerate-api" || !liveMeta?.provider
        ? "ExchangeRate-API"
        : liveMeta?.provider,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-[var(--platform-text-secondary)]">
          Storefront prices convert from USD using live mid-market rates, refreshed about every 30
          minutes. No manual input is needed on the public site.
        </p>
        <button
          type="button"
          onClick={refreshRates}
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
            Live market (1 USD)
          </dt>
          <dd className="mt-1 text-sm font-medium tabular-nums text-[var(--platform-text)]">
            {loading ? "Loading…" : formatUsdGhsRateLine(liveGhs)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--platform-text-secondary)]">
            Storefront display (1 USD)
          </dt>
          <dd className="mt-1 text-sm font-medium tabular-nums text-[var(--platform-text)]">
            {loading ? "Loading…" : formatUsdGhsRateLine(effectiveGhs)}
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
            {formatUpdatedAt(liveMeta?.fetchedAt ?? liveMeta?.rateDate)}
          </dd>
        </div>
      </dl>

      <p className="text-xs text-[var(--platform-text-secondary)]">{FX_MARKET_DISCLAIMER}</p>

      {canOverride ? (
        <div className="space-y-3 border-t border-[var(--platform-border)] pt-4">
          <Toggle
            label="Use live market rates"
            description="When off, storefront prices use your manual override below. Document snapshots stay frozen at their original rate."
            checked={useLiveRates}
            onChange={(v) => updateBool("fx_use_live_rates", v)}
          />

          {!useLiveRates ? (
            <div className="space-y-3 rounded-lg border border-[var(--platform-border)] p-4">
              <p className="text-sm font-medium text-[var(--platform-text)]">
                Manual display override — {FX_MANUAL_LABEL}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {FX_OVERRIDE_CURRENCIES.map((code) => (
                  <label
                    key={code}
                    className="space-y-1 text-xs font-medium text-[var(--platform-text-secondary)]"
                  >
                    1 USD = … {code}
                    <input
                      className="platform-input w-full tabular-nums"
                      value={
                        manualRates[code] !== undefined ? String(manualRates[code]) : ""
                      }
                      onChange={(e) => setManualRate(code, e.target.value)}
                      inputMode="decimal"
                      placeholder={
                        liveMeta?.rates?.[code] !== undefined
                          ? String(liveMeta.rates[code])
                          : ""
                      }
                      required={code === "GHS"}
                    />
                  </label>
                ))}
              </div>
              <label className="block space-y-1 text-xs font-medium text-[var(--platform-text-secondary)]">
                Reason (audited)
                <input
                  className="platform-input w-full"
                  value={settings.fx_manual_rate_reason ?? ""}
                  onChange={(e) => update("fx_manual_rate_reason", e.target.value)}
                  placeholder="Bank rate locked for weekend campaign"
                  required
                  minLength={3}
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--platform-text-secondary)]">
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
