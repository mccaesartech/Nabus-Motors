import { describe, expect, it } from "vitest";
import {
  applyDisplayRateOverride,
  isDisplayOverrideActive,
  parseManualRatesJson,
} from "@/lib/currency/display-override";
import { FX_ADMIN_OVERRIDE_LABEL, rateSourceLabel } from "@/lib/currency/meta";

describe("display rate override", () => {
  const livePayload = {
    rates: { USD: 1, GHS: 11.18, EUR: 0.9 },
    ratesFromGhs: { GHS: 1 },
    source: "exchangerate-api" as const,
    stale: false,
    fetchedAt: "2026-08-26T12:00:00.000Z",
    provider: "exchangerate-api",
  };

  it("passes through live rates when fx_use_live_rates is true", () => {
    const result = applyDisplayRateOverride(livePayload, {
      fx_use_live_rates: "true",
      fx_manual_rates_json: "{}",
      fx_manual_rate_reason: "",
      fx_manual_rate_set_by: "",
      fx_manual_rate_set_at: "",
    });
    expect(result.rates.GHS).toBe(11.18);
    expect(result.displayOverride).toBeNull();
    expect(result.source).toBe("exchangerate-api");
  });

  it("applies manual GHS for storefront display when live rates are off", () => {
    const result = applyDisplayRateOverride(livePayload, {
      fx_use_live_rates: "false",
      fx_manual_rates_json: '{"GHS":12.5}',
      fx_manual_rate_reason: "Bank deal this week",
      fx_manual_rate_set_by: "Owner",
      fx_manual_rate_set_at: "2026-08-26T12:00:00.000Z",
    });
    expect(result.rates.GHS).toBe(12.5);
    expect(result.liveRates.GHS).toBe(11.18);
    expect(result.displayOverride?.active).toBe(true);
    expect(result.displayOverride?.liveRate).toBe(11.18);
    expect(result.source).toBe("manual");
    expect(
      isDisplayOverrideActive({
        fx_use_live_rates: "false",
        fx_manual_rates_json: '{"GHS":12.5}',
        fx_manual_rate_reason: "Bank deal",
        fx_manual_rate_set_by: "Owner",
        fx_manual_rate_set_at: "2026-08-26T12:00:00.000Z",
      })
    ).toBe(true);
    expect(
      rateSourceLabel({
        source: "manual",
        isManual: true,
        isAdminDisplayOverride: true,
      })
    ).toBe(FX_ADMIN_OVERRIDE_LABEL);
  });

  it("parses manual rates json safely", () => {
    expect(parseManualRatesJson('{"GHS": 12.1}')).toEqual({ GHS: 12.1 });
    expect(parseManualRatesJson("not-json")).toEqual({});
  });
});
