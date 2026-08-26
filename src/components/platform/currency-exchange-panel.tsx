"use client";

import { useMemo, useState } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { usePlatformSession } from "@/components/platform/platform-shell";
import { CurrencyCalculator } from "@/components/shared/currency-calculator";
import { usePlatformCurrency } from "@/context/platform-currency-context";
import { canViewFinance } from "@/lib/platform/permissions";
import {
  FX_ENTITY_TYPES,
  FX_MANUAL_LABEL,
  FX_MARKET_DISCLAIMER,
  formatUsdGhsRateLine,
  formatUpdatedAt,
  getActiveRates,
  getCalculatorCurrencies,
  currencyOptionLabel,
  rateSourceLabel,
} from "@/lib/currency";
import { cn } from "@/lib/utils";

const ENTITY_LABELS: Record<string, string> = {
  sale: "Sale / quotation",
  parts_order: "Cart order / invoice",
  preorder: "Pre-order",
  expense: "Expense",
  quotation: "Quotation",
  invoice: "Invoice",
  payment: "Payment",
};

export function CurrencyExchangePanel() {
  const session = usePlatformSession();
  const { currency, ratesLoaded, ratesStale, ratesMeta } = usePlatformCurrency();
  const canOverride = session ? canViewFinance(session.role) : false;
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("sale");
  const [entityId, setEntityId] = useState("");
  const [overrideRate, setOverrideRate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const rates = getActiveRates();
  const currencies = useMemo(() => getCalculatorCurrencies(), []);
  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return currencies;
    return currencies.filter((code) => code.includes(q));
  }, [currencies, search]);

  const sourceLabel = rateSourceLabel({
    source: ratesMeta.source,
    stale: ratesStale,
    providerName:
      ratesMeta.provider === "exchangerate-api" || !ratesMeta.provider
        ? "ExchangeRate-API"
        : ratesMeta.provider,
  });

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
      setToast(
        json.stale
          ? "Live feed unavailable. Showing last-good or fallback rates."
          : "Rates refreshed from the live feed."
      );
      window.location.reload();
    } catch {
      setToast("Could not refresh rates.");
    } finally {
      setRefreshing(false);
    }
  }

  async function submitOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!canOverride) return;
    setSaving(true);
    setToast("");
    try {
      const res = await fetch("/api/admin/exchange-rates/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId: entityId.trim(),
          rateUsed: Number(overrideRate),
          reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setToast(json.message ?? "Could not save the manual rate.");
        return;
      }
      setToast(`${FX_MANUAL_LABEL} saved for this document. Live market rates are unchanged.`);
      setReason("");
    } catch {
      setToast("Could not save the manual rate.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
        <CurrencyCalculator
          defaultFromCurrency="USD"
          defaultToCurrency={currency}
          ratesLoaded={ratesLoaded}
          ratesStale={ratesStale}
          ratesMeta={ratesMeta}
          variant="platform"
        />

        <div className="space-y-4 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-card)] p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--platform-text)]">
                Live feed status
              </h2>
              <p className="mt-0.5 text-sm text-[var(--platform-text-secondary)]">
                USD-base mid-market rates, refreshed about every 30 minutes.
              </p>
            </div>
            <button
              type="button"
              onClick={refreshRates}
              disabled={refreshing}
              className="platform-btn-ghost shrink-0"
            >
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
              Refresh
            </button>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--platform-text-secondary)]">USD to GHS</dt>
              <dd className="font-medium tabular-nums text-[var(--platform-text)]">
                {formatUsdGhsRateLine(rates.GHS ?? 0)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--platform-text-secondary)]">Status</dt>
              <dd className="text-right text-[var(--platform-text)]">{sourceLabel}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--platform-text-secondary)]">Last updated</dt>
              <dd className="tabular-nums text-[var(--platform-text)]">
                {formatUpdatedAt(ratesMeta.fetchedAt ?? ratesMeta.rateDate)}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-[var(--platform-text-secondary)]">{FX_MARKET_DISCLAIMER}</p>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-card)] p-4 sm:p-6">
        <h2 className="text-base font-semibold text-[var(--platform-text)]">Search currencies</h2>
        <p className="mt-0.5 text-sm text-[var(--platform-text-secondary)]">
          Pick a code to use as the converter target. Storefront listings always convert from USD.
        </p>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ISO code (GHS, EUR, NGN…)"
          className="platform-input mt-3 w-full max-w-md"
          aria-label="Search currencies"
        />
        <ul className="mt-3 grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 md:grid-cols-3">
          {filtered.slice(0, 24).map((code) => {
            const perUsd = rates[code];
            return (
              <li
                key={code}
                className="rounded-md border border-[var(--platform-border)] px-2 py-1.5 text-xs"
              >
                <span className="font-medium text-[var(--platform-text)]">
                  {currencyOptionLabel(code)}
                </span>
                <span className="mt-0.5 block tabular-nums text-[var(--platform-text-secondary)]">
                  {typeof perUsd === "number" && perUsd > 0
                    ? `1 USD = ${perUsd >= 1 ? perUsd.toFixed(4) : perUsd.toFixed(6)} ${code}`
                    : "Rate unavailable"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {canOverride ? (
        <form
          onSubmit={submitOverride}
          className="space-y-4 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-card)] p-4 sm:p-6"
        >
          <div>
            <h2 className="text-base font-semibold text-[var(--platform-text)]">
              Manual document rate
            </h2>
            <p className="mt-0.5 text-sm text-[var(--platform-text-secondary)]">
              Applies to one quotation, order, invoice, pre-order, or expense. Never overwrites
              the live market feed. Labelled <strong>{FX_MANUAL_LABEL}</strong>.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-medium text-[var(--platform-text-secondary)]">
              Document type
              <select
                className="platform-input w-full"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
              >
                {FX_ENTITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ENTITY_LABELS[type] ?? type}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-[var(--platform-text-secondary)]">
              Document ID
              <input
                className="platform-input w-full"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="UUID"
                required
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-[var(--platform-text-secondary)]">
              Override rate (GHS per 1 USD)
              <input
                className="platform-input w-full"
                value={overrideRate}
                onChange={(e) => setOverrideRate(e.target.value)}
                inputMode="decimal"
                placeholder={String(rates.GHS ?? "")}
                required
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-[var(--platform-text-secondary)]">
              Reason (audited)
              <input
                className="platform-input w-full"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Supplier locked this deal at 12.10"
                required
                minLength={3}
              />
            </label>
          </div>
          <p className="text-xs text-[var(--platform-text-secondary)]">
            Previous live rate: {formatUsdGhsRateLine(rates.GHS ?? 0)}. Staff cannot use this
            form.
          </p>
          <button type="submit" className="platform-btn-primary" disabled={saving}>
            Save {FX_MANUAL_LABEL}
          </button>
        </form>
      ) : (
        <p className="flex items-start gap-2 text-sm text-[var(--platform-text-secondary)]">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          Manual document rates are limited to Owner and Super Admin.
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
