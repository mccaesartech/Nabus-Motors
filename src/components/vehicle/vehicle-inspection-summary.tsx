import { ShieldCheck } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { VehicleTrustBadges } from "@/components/vehicle/vehicle-trust-badges";
import { DEFAULT_TRUST_BADGES } from "@/lib/vehicles/trust-badges";

type VehicleInspectionSummaryProps = {
  vehicle: Vehicle;
};

export function VehicleInspectionSummary({ vehicle }: VehicleInspectionSummaryProps) {
  const badges = vehicle.trustBadges ?? DEFAULT_TRUST_BADGES;
  const summary =
    vehicle.inspectionSummary?.trim() ||
    (vehicle.condition === "Certified Pre-Owned"
      ? "This vehicle has passed True Goshen's quality review. Contact our team for the full inspection report and supporting documentation."
      : null);

  const hasBadges = Object.values(badges).some(Boolean);

  if (!hasBadges && !summary) return null;

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 text-brand-purple" />
        <h2 className="text-lg font-semibold">Trust & Inspection</h2>
      </div>
      {hasBadges && (
        <div className="mt-4">
          <VehicleTrustBadges badges={badges} variant="detail" />
        </div>
      )}
      {summary && (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{summary}</p>
      )}
    </div>
  );
}
