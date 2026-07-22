import {
  bucketBoundsForKey,
  bucketKeyForDate,
  bucketLabelForKey,
} from "./period-filters";
import type {
  InventoryMovementRow,
  MovementBucket,
  MovementPeriod,
  MovementSummary,
} from "./types";

export function emptyMovementSummary(): MovementSummary {
  return {
    totalInUsd: 0,
    totalOutUsd: 0,
    netUsd: 0,
    unitsIn: 0,
    unitsOut: 0,
    count: 0,
  };
}

export function summarizeMovements(rows: InventoryMovementRow[]): MovementSummary {
  const summary = emptyMovementSummary();
  for (const row of rows) {
    summary.count += 1;
    const amount = Number(row.amount_usd) || 0;
    const quantity = Number(row.quantity) || 0;
    if (row.direction === "in") {
      summary.totalInUsd += amount;
      summary.unitsIn += quantity;
    } else {
      summary.totalOutUsd += amount;
      summary.unitsOut += quantity;
    }
  }
  summary.netUsd = summary.totalInUsd - summary.totalOutUsd;
  return summary;
}

export function bucketMovements(
  rows: InventoryMovementRow[],
  period: MovementPeriod
): MovementBucket[] {
  const groups = new Map<string, InventoryMovementRow[]>();

  for (const row of rows) {
    const key = bucketKeyForDate(new Date(row.occurred_at), period);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, bucketRows]) => {
      const summary = summarizeMovements(bucketRows);
      const bounds = bucketBoundsForKey(key, period);
      return {
        bucketKey: key,
        bucketLabel: bucketLabelForKey(key, period),
        periodStart: bounds.periodStart,
        periodEnd: bounds.periodEnd,
        ...summary,
      };
    });
}

export function runningNetTotals(rows: InventoryMovementRow[]): Array<
  InventoryMovementRow & { runningNetUsd: number }
> {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );
  let running = 0;
  return sorted.map((row) => {
    const amount = Number(row.amount_usd) || 0;
    running += row.direction === "in" ? amount : -amount;
    return { ...row, runningNetUsd: running };
  });
}
