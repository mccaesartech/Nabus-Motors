import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "@/lib/images/prepare-client-upload";

describe("mapWithConcurrency", () => {
  it("preserves order and respects concurrency", async () => {
    const active: number[] = [];
    let peak = 0;

    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
      active.push(n);
      peak = Math.max(peak, active.length);
      await new Promise((r) => setTimeout(r, 10));
      active.splice(active.indexOf(n), 1);
      return n * 10;
    });

    expect(results).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
