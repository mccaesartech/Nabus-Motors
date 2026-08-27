import { describe, expect, it } from "vitest";
import {
  ConversionError,
  convertAmount,
  convertMany,
  getCrossRate,
  quotedRate,
  tryConvertAmount,
} from "@/lib/currency/convert";
import { setExchangeRates } from "@/lib/currency/rates";

describe("central conversion service", () => {
  it("converts USD to GHS and back", () => {
    setExchangeRates({ GHS: 11.18, EUR: 0.86 });
    const toGhs = convertAmount(1000, "USD", "GHS");
    expect(toGhs.convertedAmount).toBeCloseTo(11180);
    expect(toGhs.rate).toBeCloseTo(11.18);
    expect(toGhs.sourceCurrency).toBe("USD");
    expect(toGhs.targetCurrency).toBe("GHS");

    const back = convertAmount(11180, "GHS", "USD");
    expect(back.convertedAmount).toBeCloseTo(1000);
  });

  it("converts across multiple currencies via USD", () => {
    setExchangeRates({ GHS: 10, EUR: 0.9, GBP: 0.8 });
    const results = convertMany(1000, "GHS", ["USD", "EUR", "GBP"]);
    expect(results[0].convertedAmount).toBeCloseTo(100);
    expect(results[1].convertedAmount).toBeCloseTo(90);
    expect(results[2].convertedAmount).toBeCloseTo(80);
    expect(quotedRate("GHS", "EUR")).toBeCloseTo(0.09);
  });

  it("rejects invalid currency codes", () => {
    setExchangeRates({ GHS: 11 });
    expect(() => convertAmount(10, "US", "GHS")).toThrow(ConversionError);
    expect(() => convertAmount(10, "USD", "GHSS")).toThrow(ConversionError);
    expect(() => convertAmount(10, "", "GHS")).toThrow(ConversionError);
    expect(tryConvertAmount(10, "ZZZ", "USD")).toBeNull();
  });

  it("rejects non-finite amounts", () => {
    setExchangeRates({ GHS: 11 });
    expect(() => convertAmount(Number.NaN, "USD", "GHS")).toThrow(ConversionError);
    expect(() => convertAmount(Infinity, "USD", "GHS")).toThrow(ConversionError);
  });

  it("rejects missing rates instead of silently using 1", () => {
    setExchangeRates({ GHS: 11 });
    expect(() => convertAmount(10, "USD", "XXX")).toThrow(/No exchange rate/);
  });

  it("getCrossRate stays display-safe for unknown codes", () => {
    setExchangeRates({ GHS: 11 });
    expect(getCrossRate("USD", "GHS")).toBe(11);
    expect(getCrossRate("USD", "XXX")).toBe(1);
  });
});

describe("display rate override helpers", () => {
  it("detects when manual GHS override is active", async () => {
    const { isDisplayOverrideActive, parseManualRatesJson } = await import("@/lib/currency/rates");
    expect(
      isDisplayOverrideActive({
        fx_use_live_rates: "false",
        fx_manual_rates_json: '{"GHS":12.5}',
      })
    ).toBe(true);
    expect(parseManualRatesJson('{"GHS":12.1}')).toEqual({ GHS: 12.1 });
  });
});
