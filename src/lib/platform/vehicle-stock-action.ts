export type VehicleStockActionReason =
  | "auto_preorder"
  | "almost_out"
  | "purchase_almost_out";

export type VehicleStockActionInput = {
  id: string;
  slug?: string | null;
  year: number;
  make: string;
  model: string;
  reason: VehicleStockActionReason;
  /** Other approved units of same make/model/year still marked available. */
  availableSiblings: number;
  source?: string;
};

export function vehicleStockTitle(
  vehicle: Pick<VehicleStockActionInput, "year" | "make" | "model">
): string {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim();
}

/** True when the owner should be nudged to set Ghana availability or pre-order. */
export function shouldNotifyVehicleStockAction(
  reason: VehicleStockActionReason | "sold" | "purchase",
  availableSiblings: number
): boolean {
  if (reason === "auto_preorder") return true;
  // Almost out: zero or one other available unit of this make/model/year.
  return availableSiblings <= 1;
}

export function resolveStockActionReason(params: {
  autoPreOrder?: boolean;
  source: "sold" | "purchase";
  availableSiblings: number;
}): VehicleStockActionReason | null {
  if (params.autoPreOrder) return "auto_preorder";
  if (!shouldNotifyVehicleStockAction(params.source, params.availableSiblings)) {
    return null;
  }
  return params.source === "purchase" ? "purchase_almost_out" : "almost_out";
}

export function buildVehicleStockActionCopy(input: VehicleStockActionInput): {
  title: string;
  message: string;
} {
  const title = vehicleStockTitle(input);
  const remaining = input.availableSiblings;

  if (input.reason === "auto_preorder") {
    return {
      title: "Last unit sold — set fulfillment",
      message: `${title} was the last available unit and switched to Pre-order. Confirm keep as pre-order, mark another unit Available in Ghana when stock is on the lot, or add / import more units.`,
    };
  }

  if (input.reason === "purchase_almost_out") {
    if (remaining <= 0) {
      return {
        title: "Purchase — last unit of this model",
        message: `Customer ordered the only available ${title}. After confirming the sale, set the listing to Pre-order, mark a unit Available in Ghana, or add / import another unit.`,
      };
    }
    return {
      title: "Purchase — model almost out of stock",
      message: `Customer ordered ${title} — only ${remaining} other unit still available. After confirming the sale, set Available in Ghana or Pre-order, or plan to import more.`,
    };
  }

  if (remaining <= 0) {
    return {
      title: "Model out of available stock",
      message: `${title} has no other available units left. Set a listing to Pre-order, mark a unit Available in Ghana when stock arrives, or add / import more vehicles.`,
    };
  }

  return {
    title: "Model almost out of stock",
    message: `${title} sold — only ${remaining} still available. Set the remaining unit Available in Ghana if on the lot, switch it to Pre-order, or add / import more units.`,
  };
}
