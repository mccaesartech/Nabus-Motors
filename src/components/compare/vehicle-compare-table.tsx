"use client";

import Link from "next/link";
import type { Vehicle } from "@/lib/types";
import { formatMileage, formatVehicleName } from "@/lib/format";
import { useCurrency } from "@/context/currency-context";
import {
  activeTrustBadges,
  DEFAULT_TRUST_BADGES,
  TRUST_BADGE_LABELS,
} from "@/lib/vehicles/trust-badges";
import { ROUTES } from "@/lib/routes";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { primaryPhotoFor } from "@/lib/data/vehicle-images";
import { Button } from "@/components/ui/button";
import { AddToCompareButton } from "@/components/vehicle/add-to-compare-button";

type CompareRow = {
  label: string;
  get: (vehicle: Vehicle) => React.ReactNode;
};

function trustBadgeSummary(vehicle: Vehicle): string {
  const badges = vehicle.trustBadges ?? DEFAULT_TRUST_BADGES;
  const active = activeTrustBadges(badges);
  if (active.length === 0) return "—";
  return active.map((key) => TRUST_BADGE_LABELS[key]).join(", ");
}

export function VehicleCompareTable({ vehicles }: { vehicles: Vehicle[] }) {
  const { formatVehicleListPrice } = useCurrency();

  const rows: CompareRow[] = [
    { label: "Make", get: (v) => v.make },
    { label: "Model", get: (v) => v.model },
    { label: "Year", get: (v) => String(v.year) },
    {
      label: "Price",
      get: (v) => (
        <span className="font-semibold">
          {formatVehicleListPrice({
            price: v.price,
            priceCurrency: v.priceCurrency,
            listedPrice: v.listedPrice,
          })}
        </span>
      ),
    },
    { label: "Mileage", get: (v) => formatMileage(v.mileage) },
    { label: "Fuel", get: (v) => v.fuelType },
    { label: "Transmission", get: (v) => v.transmission },
    { label: "Body", get: (v) => v.bodyType },
    { label: "Condition", get: (v) => v.condition },
    { label: "Trust Badges", get: (v) => trustBadgeSummary(v) },
  ];

  return (
    <div className="scroll-touch overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="w-36 py-3 pr-4 text-left text-xs font-medium text-muted-foreground">
              Specification
            </th>
            {vehicles.map((vehicle) => (
              <th key={vehicle.id} className="min-w-[160px] py-3 px-4 text-left align-top">
                <Link
                  href={ROUTES.auto.inventoryDetail(vehicle.slug)}
                  className="group block"
                >
                  <div className="relative mb-2 aspect-[4/3] overflow-hidden rounded-md border border-border bg-muted">
                    <SafeVehicleImage
                      src={primaryPhotoFor(vehicle)}
                      alt={formatVehicleName(vehicle)}
                    />
                  </div>
                  <span className="text-xs font-semibold transition-colors group-hover:text-brand-purple">
                    {formatVehicleName(vehicle)}
                  </span>
                </Link>
                <div className="mt-2">
                  <AddToCompareButton vehicle={vehicle} variant="full" className="h-8 text-xs" />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border">
              <td className="py-3 pr-4 text-muted-foreground">{row.label}</td>
              {vehicles.map((vehicle) => (
                <td key={vehicle.id} className="py-3 px-4 font-medium">
                  {row.get(vehicle)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CompareEmptyState() {
  return (
    <div className="border border-dashed border-border py-16 text-center">
      <p className="text-sm font-medium">No vehicles to compare</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Add up to 4 vehicles from inventory to compare specifications side by side.
      </p>
      <Button className="mt-4" render={<Link href={ROUTES.auto.inventory} />}>
        Open the catalogue
      </Button>
    </div>
  );
}
