"use client";

import { Calculator } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { useCurrency } from "@/context/currency-context";
import { estimateOwnershipCosts } from "@/lib/vehicles/ownership-costs";

type VehicleOwnershipCostsProps = {
  vehicle: Vehicle;
};

export function VehicleOwnershipCosts({ vehicle }: VehicleOwnershipCostsProps) {
  const { formatPrice } = useCurrency();
  const costs = estimateOwnershipCosts({
    price: vehicle.price,
    fuelType: vehicle.fuelType,
    condition: vehicle.condition,
    mileage: vehicle.mileage,
  });

  const rows = [
    {
      label: "Estimated fuel",
      detail: `Based on ${vehicle.fuelType.toLowerCase()} usage (~1,000 mi/mo)`,
      amount: costs.fuelMonthly,
    },
    {
      label: "Insurance estimate",
      detail: "Typical comprehensive cover in Ghana",
      amount: costs.insuranceMonthly,
    },
    {
      label: "Maintenance reserve",
      detail: `${vehicle.condition} · ${vehicle.mileage.toLocaleString()} mi`,
      amount: costs.maintenanceMonthly,
    },
  ];

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2">
        <Calculator className="size-5 text-brand-purple" />
        <h2 className="text-lg font-semibold">Estimated Ownership Costs</h2>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Illustrative monthly estimates — not a binding quote. Actual costs depend on driving
        habits, insurer, and service history.
      </p>

      <div className="mt-4 grid gap-px bg-border sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="bg-white px-4 py-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{row.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{row.detail}</p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatPrice(row.amount)}
                <span className="text-xs font-normal text-muted-foreground">/mo</span>
              </span>
            </div>
          </div>
        ))}
        <div className="bg-muted/40 px-4 py-3 text-sm sm:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold">Estimated monthly total</span>
            <span className="text-base font-semibold tabular-nums text-brand-purple">
              {formatPrice(costs.totalMonthly)}
              <span className="text-xs font-normal text-muted-foreground">/mo</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
