import type { Condition, FuelType } from "@/lib/types";

export type OwnershipCostEstimate = {
  fuelMonthly: number;
  insuranceMonthly: number;
  maintenanceMonthly: number;
  totalMonthly: number;
};

const FUEL_MONTHLY_USD: Record<FuelType, number> = {
  Petrol: 180,
  Diesel: 165,
  Hybrid: 95,
  Electric: 50,
  "Plug-in Hybrid": 75,
};

function maintenanceMonthlyUsd(condition: Condition, mileage: number): number {
  if (condition === "New") return 55;
  if (condition === "Certified Pre-Owned") return 85;
  if (mileage >= 100_000) return 130;
  if (mileage >= 60_000) return 105;
  return 80;
}

/** Simple monthly ownership estimates — illustrative, not a quote. */
export function estimateOwnershipCosts(input: {
  price: number;
  fuelType: FuelType;
  condition: Condition;
  mileage: number;
}): OwnershipCostEstimate {
  const fuelMonthly = FUEL_MONTHLY_USD[input.fuelType] ?? 150;
  const insuranceMonthly = Math.max(45, Math.round((input.price * 0.038) / 12));
  const maintenanceMonthly = maintenanceMonthlyUsd(input.condition, input.mileage);
  const totalMonthly = fuelMonthly + insuranceMonthly + maintenanceMonthly;

  return { fuelMonthly, insuranceMonthly, maintenanceMonthly, totalMonthly };
}
