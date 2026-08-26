"use client";

import { PageHeader } from "@/components/platform/page-header";
import { CurrencyExchangePanel } from "@/components/platform/currency-exchange-panel";

export default function PlatformCurrencyToolsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Currency & exchange rates"
        description="Convert amounts and see the live USD to GHS rate used on the storefront. Owner and Super Admin can set a manual display rate when needed."
        breadcrumb="Tools / Currency"
      />
      <CurrencyExchangePanel />
    </div>
  );
}
