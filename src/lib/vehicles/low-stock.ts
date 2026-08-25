import { isLowStock } from "@/lib/platform/site-settings";

/**
 * Stock model (True Goshen Auto):
 * Each listing row carries `stock_quantity` units (migration 082). Legacy rows
 * without the column count as 1 unit (one-row-per-VIN).
 *
 * - Fleet low stock: total `status = available` units < `inventory_low_stock_threshold`
 * - Model low stock: available units of the same make + model + year ≤ MODEL_LOW_STOCK_THRESHOLD
 * - Marking sold / completing a sale decrements `stock_quantity` by 1; the last unit
 *   flips status to sold (siblings remain) or pre_order (none left).
 *
 * Model threshold stays at 1 so unique-VIN inventory is not permanently highlighted.
 */
export const MODEL_LOW_STOCK_THRESHOLD = 1;

/** Group key for counting same-type inventory (make + model + year). */
export function stockGroupKey(make: string, model: string, year: number): string {
  return `${make.trim().toLowerCase()}|${model.trim().toLowerCase()}|${year}`;
}

export type ModelStockLevel = "ok" | "low" | "out";

export type StockIdentity = {
  make: string;
  model: string;
  year: number;
  status?: string | null;
  /** Units in stock for this listing (migration 082). Missing/legacy rows = 1 unit. */
  stock_quantity?: number | null;
};

/** Units on one listing: `stock_quantity` when set, else 1 (legacy one-row-per-unit). */
export function listingUnitCount(vehicle: Pick<StockIdentity, "stock_quantity">): number {
  const quantity = vehicle.stock_quantity;
  if (quantity === null || quantity === undefined) return 1;
  const n = Number(quantity);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.floor(n));
}

/** Available unit count per make|model|year (sums per-listing stock_quantity). */
export function buildAvailableStockCounts(
  vehicles: StockIdentity[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const vehicle of vehicles) {
    if (vehicle.status !== "available") continue;
    const key = stockGroupKey(vehicle.make, vehicle.model, vehicle.year);
    counts.set(key, (counts.get(key) ?? 0) + listingUnitCount(vehicle));
  }
  return counts;
}

export function availableCountForVehicle(
  vehicle: StockIdentity,
  counts: Map<string, number>
): number {
  return counts.get(stockGroupKey(vehicle.make, vehicle.model, vehicle.year)) ?? 0;
}

/** Current stock ≤ model threshold → low; zero available → out. */
export function modelStockLevel(availableCount: number): ModelStockLevel {
  if (availableCount <= 0) return "out";
  if (availableCount <= MODEL_LOW_STOCK_THRESHOLD) return "low";
  return "ok";
}

export function isModelLowStock(availableCount: number): boolean {
  return modelStockLevel(availableCount) !== "ok";
}

/**
 * Highlight active sellable rows when their model group is low/out.
 * Sold/reserved units are left alone so the list stays scannable.
 */
export function shouldHighlightVehicleStock(
  vehicle: StockIdentity,
  counts: Map<string, number>
): boolean {
  const status = vehicle.status ?? "";
  if (status !== "available" && status !== "pre_order") return false;
  return isModelLowStock(availableCountForVehicle(vehicle, counts));
}

export function countLowStockModelGroups(counts: Map<string, number>): number {
  let n = 0;
  for (const available of counts.values()) {
    if (isModelLowStock(available)) n += 1;
  }
  return n;
}

/** Groups with zero available still matter when pre-order stand-ins exist. */
export function listLowStockGroups(
  vehicles: StockIdentity[],
  counts: Map<string, number>
): Array<{ key: string; make: string; model: string; year: number; available: number; level: ModelStockLevel }> {
  const seen = new Map<
    string,
    { key: string; make: string; model: string; year: number; available: number; level: ModelStockLevel }
  >();

  for (const vehicle of vehicles) {
    const key = stockGroupKey(vehicle.make, vehicle.model, vehicle.year);
    if (seen.has(key)) continue;
    const available = counts.get(key) ?? 0;
    const level = modelStockLevel(available);
    if (level === "ok") continue;
    // Only surface groups that still have an available or pre-order listing.
    const hasActive = vehicles.some(
      (v) =>
        stockGroupKey(v.make, v.model, v.year) === key &&
        (v.status === "available" || v.status === "pre_order")
    );
    if (!hasActive) continue;
    seen.set(key, {
      key,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      available,
      level,
    });
  }

  return [...seen.values()].sort((a, b) => a.available - b.available);
}

export function buildFleetLowStockMessage(
  availableVehicles: number,
  threshold: number
): string {
  return (
    `Only ${availableVehicles} vehicle${availableVehicles === 1 ? "" : "s"} available ` +
    `(threshold ${threshold}). Consider adding inventory, importing more units, ` +
    `or setting key models to Pre-order / Available in Ghana.`
  );
}

export function fleetIsLowStock(
  availableVehicles: number,
  threshold: number,
  notifyEnabled = true
): boolean {
  return notifyEnabled && isLowStock(availableVehicles, threshold);
}

export { isLowStock };
