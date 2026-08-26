"use client";

import { PageHeader } from "@/components/platform/page-header";
import { CurrencyCalculator } from "@/components/shared/currency-calculator";
import { usePlatformCurrency } from "@/context/platform-currency-context";

export default function PlatformCurrencyToolsPage() {
  const { currency, ratesLoaded, ratesStale, ratesMeta } = usePlatformCurrency();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Currency converter"
        description="Convert any amount using the same live exchange rates as platform price displays."
        breadcrumb="Tools / Currency"
      />
      <CurrencyCalculator
        defaultFromCurrency="USD"
        defaultToCurrency={currency}
        ratesLoaded={ratesLoaded}
        ratesStale={ratesStale}
        ratesMeta={ratesMeta}
        variant="platform"
        className="max-w-3xl"
      />
    </div>
  );
}
