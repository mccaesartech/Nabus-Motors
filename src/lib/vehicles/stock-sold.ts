/**
 * Pure sold-unit resolution (no DB / server-only imports).
 * Used by stock-automation and unit tests.
 */
export type UnitSoldTransition = {
  status: "available" | "sold" | "pre_order";
  stock_quantity: number;
  /** True when qty decreased but the listing remains available. */
  unitDecremented: boolean;
  autoPreOrder: boolean;
  availableSiblings: number;
  /** Available units of this make/model/year after this sale. */
  remainingInGroup: number;
};

/**
 * When the last available unit of a type sells, keep the listing on-site as pre-order
 * instead of hiding it as sold.
 */
export function resolveStatusAfterSoldTransition(
  availableSiblings: number
): "sold" | "pre_order" {
  return availableSiblings === 0 ? "pre_order" : "sold";
}

/**
 * Sell one unit from `currentQuantity`, given sibling availability.
 */
export function resolveUnitSoldFromQuantity(
  currentQuantity: number,
  availableSiblings: number
): UnitSoldTransition {
  const qty = Math.max(0, Math.floor(Number(currentQuantity) || 0));

  if (qty > 1) {
    const stock_quantity = qty - 1;
    return {
      status: "available",
      stock_quantity,
      unitDecremented: true,
      autoPreOrder: false,
      availableSiblings,
      remainingInGroup: availableSiblings + stock_quantity,
    };
  }

  const status = resolveStatusAfterSoldTransition(availableSiblings);
  return {
    status,
    stock_quantity: 0,
    unitDecremented: false,
    autoPreOrder: status === "pre_order",
    availableSiblings,
    remainingInGroup: availableSiblings,
  };
}