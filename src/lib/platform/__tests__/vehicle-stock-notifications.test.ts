import { describe, expect, it } from "vitest";
import {
  buildVehicleStockActionCopy,
  resolveStockActionReason,
  shouldNotifyVehicleStockAction,
} from "@/lib/platform/vehicle-stock-action";

describe("shouldNotifyVehicleStockAction", () => {
  it("always notifies on auto pre-order", () => {
    expect(shouldNotifyVehicleStockAction("auto_preorder", 5)).toBe(true);
  });

  it("notifies when almost out (0–1 siblings)", () => {
    expect(shouldNotifyVehicleStockAction("sold", 0)).toBe(true);
    expect(shouldNotifyVehicleStockAction("sold", 1)).toBe(true);
    expect(shouldNotifyVehicleStockAction("purchase", 1)).toBe(true);
  });

  it("skips when healthy stock remains", () => {
    expect(shouldNotifyVehicleStockAction("sold", 2)).toBe(false);
    expect(shouldNotifyVehicleStockAction("purchase", 3)).toBe(false);
  });
});

describe("resolveStockActionReason", () => {
  it("prefers auto_preorder", () => {
    expect(
      resolveStockActionReason({
        autoPreOrder: true,
        source: "sold",
        availableSiblings: 0,
      })
    ).toBe("auto_preorder");
  });

  it("returns null when stock is healthy", () => {
    expect(
      resolveStockActionReason({
        source: "sold",
        availableSiblings: 4,
      })
    ).toBeNull();
  });

  it("maps purchase vs sold almost-out", () => {
    expect(
      resolveStockActionReason({ source: "purchase", availableSiblings: 1 })
    ).toBe("purchase_almost_out");
    expect(
      resolveStockActionReason({ source: "sold", availableSiblings: 0 })
    ).toBe("almost_out");
  });
});

describe("buildVehicleStockActionCopy", () => {
  const base = {
    id: "v1",
    year: 2024,
    make: "Toyota",
    model: "Camry",
    availableSiblings: 0,
  };

  it("prompts Ghana or pre-order after auto pre-order", () => {
    const copy = buildVehicleStockActionCopy({
      ...base,
      reason: "auto_preorder",
      availableSiblings: 0,
    });
    expect(copy.title).toMatch(/fulfillment/i);
    expect(copy.message).toMatch(/Pre-order/);
    expect(copy.message).toMatch(/Available in Ghana/);
    expect(copy.message).toMatch(/add \/ import|import/i);
  });

  it("prompts after purchase of last unit", () => {
    const copy = buildVehicleStockActionCopy({
      ...base,
      reason: "purchase_almost_out",
      availableSiblings: 0,
    });
    expect(copy.message).toMatch(/only available/i);
    expect(copy.message).toMatch(/Available in Ghana/);
    expect(copy.message).toMatch(/add \/ import|import/i);
  });

  it("prompts when one sibling remains after sale", () => {
    const copy = buildVehicleStockActionCopy({
      ...base,
      reason: "almost_out",
      availableSiblings: 1,
    });
    expect(copy.title).toMatch(/almost out/i);
    expect(copy.message).toMatch(/only 1/);
    expect(copy.message).toMatch(/Available in Ghana|Pre-order/);
    expect(copy.message).toMatch(/add \/ import|import/i);
  });
});
