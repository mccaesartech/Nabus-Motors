import { describe, expect, it } from "vitest";
import {
  resolveStatusAfterSoldTransition,
  resolveUnitSoldFromQuantity,
} from "@/lib/vehicles/stock-sold";

describe("resolveStatusAfterSoldTransition", () => {
  it("pre-orders when no siblings remain", () => {
    expect(resolveStatusAfterSoldTransition(0)).toBe("pre_order");
  });

  it("marks sold when other available listings remain", () => {
    expect(resolveStatusAfterSoldTransition(1)).toBe("sold");
    expect(resolveStatusAfterSoldTransition(3)).toBe("sold");
  });
});

describe("resolveUnitSoldFromQuantity", () => {
  it("decrements multi-unit listings and keeps them available", () => {
    const result = resolveUnitSoldFromQuantity(5, 0);
    expect(result).toEqual({
      status: "available",
      stock_quantity: 4,
      unitDecremented: true,
      autoPreOrder: false,
      availableSiblings: 0,
      remainingInGroup: 4,
    });
  });

  it("counts siblings toward remainingInGroup after decrement", () => {
    const result = resolveUnitSoldFromQuantity(3, 2);
    expect(result.status).toBe("available");
    expect(result.stock_quantity).toBe(2);
    expect(result.remainingInGroup).toBe(4);
    expect(result.unitDecremented).toBe(true);
  });

  it("moves last unit to pre_order when no siblings", () => {
    const result = resolveUnitSoldFromQuantity(1, 0);
    expect(result).toEqual({
      status: "pre_order",
      stock_quantity: 0,
      unitDecremented: false,
      autoPreOrder: true,
      availableSiblings: 0,
      remainingInGroup: 0,
    });
  });

  it("marks last unit sold when siblings remain", () => {
    const result = resolveUnitSoldFromQuantity(1, 2);
    expect(result.status).toBe("sold");
    expect(result.stock_quantity).toBe(0);
    expect(result.autoPreOrder).toBe(false);
    expect(result.remainingInGroup).toBe(2);
  });

  it("treats zero quantity like last unit", () => {
    const result = resolveUnitSoldFromQuantity(0, 0);
    expect(result.status).toBe("pre_order");
    expect(result.stock_quantity).toBe(0);
    expect(result.autoPreOrder).toBe(true);
  });
});