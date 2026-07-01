import { Suspense } from "react";
import { ShipmentManager } from "@/components/platform/shipment-manager";

function FreightTrackingContent() {
  return (
    <ShipmentManager
      title="Freight Tracking"
      description="Create and manage shipment records, timeline events, and customer-visible updates."
      breadcrumb="FREIGHT · Tracking"
      referenceType="freight"
    />
  );
}

export default function FreightTrackingPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-[var(--platform-text-secondary)]">Loading freight tracking…</p>
      }
    >
      <FreightTrackingContent />
    </Suspense>
  );
}
