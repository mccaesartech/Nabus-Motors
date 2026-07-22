import { describe, expect, it } from "vitest";
import {
  bucketMovements,
  runningNetTotals,
  summarizeMovements,
} from "@/lib/platform/inventory-movements/aggregate";
import {
  bucketKeyForDate,
  bucketLabelForKey,
  resolvePeriodRange,
  toIsoDateInput,
} from "@/lib/platform/inventory-movements/period-filters";
import type { InventoryMovementRow } from "@/lib/platform/inventory-movements/types";

function movement(
  partial: Partial<InventoryMovementRow> & Pick<InventoryMovementRow, "occurred_at" | "direction" | "amount_usd">
): InventoryMovementRow {
  return {
    id: partial.id ?? crypto.randomUUID(),
    occurred_at: partial.occurred_at,
    direction: partial.direction,
    asset_type: partial.asset_type ?? "vehicle",
    movement_type: partial.movement_type ?? "vehicle_received",
    description: partial.description ?? "Test",
    quantity: partial.quantity ?? 1,
    amount_usd: partial.amount_usd,
    asset_id: partial.asset_id ?? null,
    reference_type: partial.reference_type ?? null,
    reference_id: partial.reference_id ?? null,
    metadata: partial.metadata ?? {},
    source: partial.source ?? "system",
    created_by_user_id: null,
    created_by_name: null,
    created_at: partial.created_at ?? partial.occurred_at,
  };
}

describe("resolvePeriodRange", () => {
  const anchor = new Date("2026-07-22T15:30:00.000Z");

  it("resolves day boundaries in UTC", () => {
    const range = resolvePeriodRange("day", anchor);
    expect(toIsoDateInput(range.from)).toBe("2026-07-22");
    expect(toIsoDateInput(range.to)).toBe("2026-07-22");
  });

  it("resolves week starting Monday UTC", () => {
    const range = resolvePeriodRange("week", anchor);
    expect(toIsoDateInput(range.from)).toBe("2026-07-20");
    expect(toIsoDateInput(range.to)).toBe("2026-07-26");
  });

  it("resolves month boundaries", () => {
    const range = resolvePeriodRange("month", anchor);
    expect(toIsoDateInput(range.from)).toBe("2026-07-01");
    expect(toIsoDateInput(range.to)).toBe("2026-07-31");
  });

  it("resolves year boundaries", () => {
    const range = resolvePeriodRange("year", anchor);
    expect(toIsoDateInput(range.from)).toBe("2026-01-01");
    expect(toIsoDateInput(range.to)).toBe("2026-12-31");
  });

  it("supports custom date range", () => {
    const range = resolvePeriodRange("range", anchor, "2026-07-01", "2026-07-10");
    expect(toIsoDateInput(range.from)).toBe("2026-07-01");
    expect(toIsoDateInput(range.to)).toBe("2026-07-10");
  });
});

describe("bucketKeyForDate", () => {
  it("groups by day, month, and year", () => {
    const date = new Date("2026-03-15T10:00:00.000Z");
    expect(bucketKeyForDate(date, "day")).toBe("2026-03-15");
    expect(bucketKeyForDate(date, "month")).toBe("2026-03");
    expect(bucketKeyForDate(date, "year")).toBe("2026");
  });

  it("labels month buckets readably", () => {
    expect(bucketLabelForKey("2026-03", "month")).toBe("Mar 2026");
  });
});

describe("summarizeMovements", () => {
  it("totals financial in/out and units", () => {
    const rows = [
      movement({ occurred_at: "2026-01-01T00:00:00.000Z", direction: "in", amount_usd: 1000, quantity: 1 }),
      movement({ occurred_at: "2026-01-02T00:00:00.000Z", direction: "out", amount_usd: 200, quantity: 0 }),
      movement({ occurred_at: "2026-01-03T00:00:00.000Z", direction: "in", amount_usd: 500, quantity: 3 }),
    ];

    const summary = summarizeMovements(rows);
    expect(summary.totalInUsd).toBe(1500);
    expect(summary.totalOutUsd).toBe(200);
    expect(summary.netUsd).toBe(1300);
    expect(summary.unitsIn).toBe(4);
    expect(summary.unitsOut).toBe(0);
    expect(summary.count).toBe(3);
  });
});

describe("bucketMovements", () => {
  it("aggregates rows into monthly buckets", () => {
    const rows = [
      movement({ occurred_at: "2026-01-05T00:00:00.000Z", direction: "in", amount_usd: 100 }),
      movement({ occurred_at: "2026-01-20T00:00:00.000Z", direction: "out", amount_usd: 40 }),
      movement({ occurred_at: "2026-02-01T00:00:00.000Z", direction: "in", amount_usd: 300 }),
    ];

    const buckets = bucketMovements(rows, "month");
    expect(buckets).toHaveLength(2);
    expect(buckets[0]?.bucketKey).toBe("2026-01");
    expect(buckets[0]?.netUsd).toBe(60);
    expect(buckets[1]?.bucketKey).toBe("2026-02");
    expect(buckets[1]?.totalInUsd).toBe(300);
  });
});

describe("runningNetTotals", () => {
  it("computes cumulative net by occurred_at ascending", () => {
    const rows = [
      movement({ occurred_at: "2026-01-03T00:00:00.000Z", direction: "in", amount_usd: 100 }),
      movement({ occurred_at: "2026-01-01T00:00:00.000Z", direction: "in", amount_usd: 50 }),
      movement({ occurred_at: "2026-01-02T00:00:00.000Z", direction: "out", amount_usd: 20 }),
    ];

    const running = runningNetTotals(rows);
    expect(running.map((row) => row.runningNetUsd)).toEqual([50, 30, 130]);
  });
});
