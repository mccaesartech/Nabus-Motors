"use client";

import { PageHeader } from "@/components/platform/page-header";
import { CurrencyExchangePanel } from "@/components/platform/currency-exchange-panel";

export default function PlatformCurrencyToolsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Currency & exchange rates"
        description="Convert amounts with the same USD mid-market feed used for storefront prices. Manual rates apply to a single document only."
        breadcrumb="Tools / Currency"
      />
      <CurrencyExchangePanel />
    </div>
  );
}
