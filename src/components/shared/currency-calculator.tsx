"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Calculator } from "lucide-react";
import {
  convertBetweenCurrencies,
  formatAmount,
  getCrossRate,
  getActiveRates,
} from "@/lib/currency";
import {
  currencyOptionLabel,
  getCalculatorCurrencies,
} from "@/lib/currency/calculator-currencies";
import type { ExchangeRatesMeta } from "@/hooks/use-exchange-rates";
import { cn } from "@/lib/utils";

type CurrencyCalculatorProps = {
  /** Prefer visitor/platform display currency as the default "from". */
  defaultFromCurrency?: string;
  defaultToCurrency?: string;
  ratesLoaded: boolean;
  ratesStale: boolean;
  ratesMeta?: ExchangeRatesMeta;
  /** Visual variant for public site vs platform admin. */
  variant?: "public" | "platform";
  className?: string;
};

function formatRate(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return "-";
  if (rate >= 100) return rate.toFixed(2);
  if (rate >= 1) return rate.toFixed(4);
  return rate.toFixed(6);
}

function formatUpdatedAt(iso: string | null | undefined): string {
  if (!iso) return "Unavailable";
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function CurrencyCalculator({
  defaultFromCurrency = "USD",
  defaultToCurrency = "GHS",
  ratesLoaded,
  ratesStale,
  ratesMeta,
  variant = "public",
  className,
}: CurrencyCalculatorProps) {
  const currencies = useMemo(() => getCalculatorCurrencies(), []);
  const [amount, setAmount] = useState("1000");
  const [fromCurrency, setFromCurrency] = useState(
    defaultFromCurrency.toUpperCase()
  );
  const [toCurrency, setToCurrency] = useState(defaultToCurrency.toUpperCase());

  useEffect(() => {
    setFromCurrency(defaultFromCurrency.toUpperCase());
  }, [defaultFromCurrency]);

  useEffect(() => {
    setToCurrency(defaultToCurrency.toUpperCase());
  }, [defaultToCurrency]);

  const parsedAmount = Number(amount.replace(/,/g, ""));
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount >= 0;

  const rates = getActiveRates();
  const crossRate = getCrossRate(fromCurrency, toCurrency, rates);
  const converted = amountValid
    ? convertBetweenCurrencies(parsedAmount, fromCurrency, toCurrency, rates)
    : 0;

  const isPlatform = variant === "platform";

  const inputClass = isPlatform
    ? "platform-input w-full"
    : "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const selectClass = isPlatform
    ? "platform-input w-full"
    : "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  function swapCurrencies() {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  }

  const updatedLabel = ratesMeta?.fetchedAt
    ? formatUpdatedAt(ratesMeta.fetchedAt)
    : ratesMeta?.rateDate
      ? formatUpdatedAt(ratesMeta.rateDate)
      : null;

  return (
    <div
      className={cn(
        isPlatform
          ? "space-y-4 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-card)] p-4 sm:p-6"
          : "space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            isPlatform
              ? "bg-[rgba(139,92,246,0.12)] text-[var(--platform-accent)]"
              : "bg-brand-primary/10 text-brand-primary"
          )}
        >
          <Calculator className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2
            className={cn(
              "text-base font-semibold",
              isPlatform ? "text-[var(--platform-text)]" : "text-foreground"
            )}
          >
            Convert currency
          </h2>
          <p
            className={cn(
              "mt-0.5 text-sm",
              isPlatform
                ? "text-[var(--platform-text-secondary)]"
                : "text-muted-foreground"
            )}
          >
            Same live USD rates as vehicle prices. Guidance only — not a bank
            quote. May differ slightly from Google Finance.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <div className="space-y-2">
          <label
            htmlFor="currency-calc-amount"
            className={cn(
              "text-xs font-medium",
              isPlatform
                ? "text-[var(--platform-text-secondary)]"
                : "text-muted-foreground"
            )}
          >
            Amount
          </label>
          <input
            id="currency-calc-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
            aria-invalid={!amountValid}
          />
          <label
            htmlFor="currency-calc-from"
            className={cn(
              "text-xs font-medium",
              isPlatform
                ? "text-[var(--platform-text-secondary)]"
                : "text-muted-foreground"
            )}
          >
            From
          </label>
          <select
            id="currency-calc-from"
            value={fromCurrency}
            onChange={(e) => setFromCurrency(e.target.value)}
            className={selectClass}
          >
            {currencies.map((code) => (
              <option key={code} value={code}>
                {currencyOptionLabel(code)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-center pb-1 sm:pb-2">
          <button
            type="button"
            onClick={swapCurrencies}
            className={cn(
              "inline-flex size-10 items-center justify-center rounded-full border transition-colors",
              isPlatform
                ? "border-[var(--platform-border)] text-[var(--platform-text)] hover:bg-[rgba(139,92,246,0.08)]"
                : "border-border text-foreground hover:bg-muted"
            )}
            aria-label="Swap currencies"
          >
            <ArrowLeftRight className="size-4" />
          </button>
        </div>

        <div className="space-y-2">
          <p
            className={cn(
              "text-xs font-medium",
              isPlatform
                ? "text-[var(--platform-text-secondary)]"
                : "text-muted-foreground"
            )}
          >
            Converted
          </p>
          <p
            className={cn(
              "flex h-10 items-center text-lg font-semibold tabular-nums",
              isPlatform ? "text-[var(--platform-text)]" : "text-foreground"
            )}
            aria-live="polite"
          >
            {!ratesLoaded
              ? "Loading rates..."
              : amountValid
                ? formatAmount(converted, toCurrency)
                : "-"}
          </p>
          <label
            htmlFor="currency-calc-to"
            className={cn(
              "text-xs font-medium",
              isPlatform
                ? "text-[var(--platform-text-secondary)]"
                : "text-muted-foreground"
            )}
          >
            To
          </label>
          <select
            id="currency-calc-to"
            value={toCurrency}
            onChange={(e) => setToCurrency(e.target.value)}
            className={selectClass}
          >
            {currencies.map((code) => (
              <option key={code} value={code}>
                {currencyOptionLabel(code)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        className={cn(
          "space-y-1 border-t pt-3 text-xs",
          isPlatform
            ? "border-[var(--platform-border)] text-[var(--platform-text-secondary)]"
            : "border-border text-muted-foreground"
        )}
      >
        <p>
          {ratesLoaded
            ? `1 ${fromCurrency} = ${formatRate(crossRate)} ${toCurrency}`
            : "Fetching exchange rates..."}
        </p>
        {updatedLabel ? <p>Rates updated: {updatedLabel}</p> : null}
        {ratesMeta?.provider && ratesLoaded && !ratesStale ? (
          <p>
            Source:{" "}
            {ratesMeta.provider === "exchangerate-api"
              ? "ExchangeRate-API"
              : ratesMeta.provider}
            . Listings convert from canonical USD with this same rate.
          </p>
        ) : null}
        {ratesStale ? (
          <p
            className={
              isPlatform
                ? "font-medium text-amber-600"
                : "font-medium text-amber-700"
            }
            role="status"
          >
            Approximate rates - live feed unavailable; showing fallbacks.
          </p>
        ) : null}
      </div>
    </div>
  );
}

