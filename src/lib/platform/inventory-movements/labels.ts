import type { MovementAssetType, MovementDirection } from "./types";

export function movementTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    vehicle_received: "Vehicle received",
    vehicle_sold: "Vehicle sold / dispatched",
    sale_completed: "Sale completed",
    part_stock_in: "Parts stock in",
    part_stock_out: "Parts stock out",
    order_confirmed: "Order confirmed",
    preorder_deposit: "Pre-order deposit",
    expense_recorded: "Expense recorded",
  };
  return labels[type] ?? type.replace(/_/g, " ");
}

export function assetTypeLabel(type: MovementAssetType | string): string {
  const labels: Record<string, string> = {
    vehicle: "Vehicle",
    part: "Part",
    expense: "Expense",
    sale: "Sale",
    preorder: "Pre-order",
    order: "Order",
  };
  return labels[type] ?? type;
}

export function directionLabel(direction: MovementDirection): string {
  return direction === "in" ? "In" : "Out";
}
