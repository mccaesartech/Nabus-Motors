import { describe, expect, it } from "vitest";
import { computeInventoryChartSegments } from "@/lib/platform/inventory-chart";

describe("computeInventoryChartSegments", () => {
  it("keeps available vehicles in Available when only a pending-payment preorder exists", () => {
    const segments = computeInventoryChartSegments(
      [{ id: "v1", status: "available" }],
      [{ vehicle_id: "v1", payment_status: "pending", status: "new" }]
    );

    expect(segments.available).toBe(1);
    expect(segments.preOrderPending).toBe(1);
    expect(segments.reserved).toBe(0);
  });

  it("excludes deposit-paid preorder vehicles from Available until status is reserved/sold", () => {
    const segments = computeInventoryChartSegments(
      [{ id: "v1", status: "available" }],
      [{ vehicle_id: "v1", payment_status: "down_payment_paid", status: "qualified" }]
    );

    expect(segments.available).toBe(0);
    expect(segments.preOrderConfirmed).toBe(1);
  });

  it("counts reserved vehicles under Reserved", () => {
    const segments = computeInventoryChartSegments(
      [{ id: "v1", status: "reserved" }],
      []
    );

    expect(segments.reserved).toBe(1);
    expect(segments.available).toBe(0);
  });
});