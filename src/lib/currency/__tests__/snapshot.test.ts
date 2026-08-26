import { describe, expect, it } from "vitest";
import { setExchangeRates } from "@/lib/currency/rates";
import {
  applyManualOverride,
  buildFxSnapshot,
  isManualRateLabel,
  ratesMapFromSnapshot,
  snapshotConversion,
  snapshotRateLabel,
  FX_MANUAL_LABEL,
} from "@/lib/currency/snapshot";
import { convertAmount } from "@/lib/currency/convert";
import { rateSourceLabel } from "@/lib/currency/meta";

function livePayload(ghs: number) {
  return {
    rates: { USD: 1, GHS: ghs, EUR: 0.9 },
    source: "exchangerate-api" as const,
    fetchedAt: "2026-08-26T12:00:00.000Z",
    rateDate: "Wed, 26 Aug 2026 00:00:00 +0000",
    provider: "exchangerate-api",
  };
}

describe("FX snapshots", () => {
  it("freezes the conversion so later live rates cannot change it", () => {
    setExchangeRates({ GHS: 11.18, EUR: 0.9 });
    const snapshot = buildFxSnapshot({
      entityType: "parts_order",
      entityId: "11111111-1111-1111-1111-111111111111",
      originalAmount: 10_000,
      payload: livePayload(11.18),
    });

    expect(snapshot.rateUsed).toBeCloseTo(11.18);
    expect(snapshot.convertedAmount).toBe(111800);

    setExchangeRates({ GHS: 20, EUR: 0.9 });
    const liveNow = convertAmount(10_000, "USD", "GHS");
    expect(liveNow.convertedAmount).toBe(200_000);

    const frozen = snapshotConversion(snapshot);
    expect(frozen.convertedAmount).toBeCloseTo(111800);
    expect(ratesMapFromSnapshot(snapshot).GHS).toBeCloseTo(11.18);
  });

  it("labels manual overrides as Manual Exchange Rate, never live market", () => {
    const snapshot = buildFxSnapshot({
      entityType: "sale",
      entityId: "22222222-2222-2222-2222-222222222222",
      originalAmount: 5_000,
      payload: livePayload(11.18),
    });

    expect(snapshotRateLabel(snapshot)).toMatch(/Live mid-market/);
    expect(isManualRateLabel(snapshotRateLabel(snapshot))).toBe(false);

    const overridden = applyManualOverride(snapshot, {
      rateUsed: 12.5,
      reason: "Supplier locked this deal",
      actorId: "owner",
      actorName: "Owner",
      at: "2026-08-26T13:00:00.000Z",
    });

    expect(overridden.isManual).toBe(true);
    expect(overridden.rateUsed).toBe(12.5);
    expect(overridden.convertedAmount).toBe(62_500);
    expect(overridden.previousLiveRate).toBeCloseTo(11.18);
    expect(snapshotRateLabel(overridden)).toBe(FX_MANUAL_LABEL);
    expect(isManualRateLabel(snapshotRateLabel(overridden))).toBe(true);
    expect(rateSourceLabel({ isManual: true, source: "exchangerate-api" })).toBe(
      FX_MANUAL_LABEL
    );
    expect(rateSourceLabel({ source: "fallback", stale: true })).toMatch(/fallback/i);
    expect(rateSourceLabel({ source: "cache", stale: true })).toMatch(/Cached/i);
  });

  it("does not mutate the original snapshot object", () => {
    const snapshot = buildFxSnapshot({
      entityType: "preorder",
      entityId: "33333333-3333-3333-3333-333333333333",
      originalAmount: 1_000,
      payload: livePayload(11),
    });
    const originalRate = snapshot.rateUsed;

    applyManualOverride(snapshot, {
      rateUsed: 15,
      reason: "Test override",
      actorId: "u1",
      actorName: "Admin",
    });

    expect(snapshot.rateUsed).toBe(originalRate);
    expect(snapshot.isManual).toBe(false);
  });
});
