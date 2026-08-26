import { describe, expect, it } from "vitest";
import { setExchangeRates } from "@/lib/currency/rates";
import { getCrossRate } from "@/lib/currency/convert";
import {
  buildRatesFromGhs,
  mergeLiveRates,
} from "@/lib/currency/fetch-exchange-rates";
import {
  convertBetweenCurrencies,
  convertToUsd,
  formatVehiclePrice,
  listingAmountForForm,
  toStoredVehiclePrice,
} from "@/lib/currency/listing";

describe("live exchange rate helpers", () => {
  it("buildRatesFromGhs converts USD-base rates to GHS anchor", () => {
    const fromGhs = buildRatesFromGhs({ USD: 1, GHS: 10, EUR: 0.9 });
    expect(fromGhs.GHS).toBe(1);
    expect(fromGhs.USD).toBeCloseTo(0.1);
    expect(fromGhs.EUR).toBeCloseTo(0.09);
  });

  it("mergeLiveRates overlays API values on fallbacks", () => {
    const merged = mergeLiveRates({ GHS: 11.18, EUR: 0.86, NGN: 1350 });
    expect(merged.USD).toBe(1);
    expect(merged.GHS).toBe(11.18);
    expect(merged.EUR).toBe(0.86);
    expect(merged.NGN).toBe(1350);
    expect(merged.GBP).toBeGreaterThan(0);
  });
});

describe("listing currency helpers", () => {
  it("converts GHS listing amounts to USD for storage", () => {
    setExchangeRates({ GHS: 15.5, EUR: 0.92 });
    const stored = toStoredVehiclePrice(155_000, "GHS");
    expect(stored.price_currency).toBe("GHS");
    expect(stored.listed_price).toBe(155_000);
    expect(stored.price).toBe(10_000);
  });

  it("keeps USD listings unchanged", () => {
    setExchangeRates({ GHS: 15.5 });
    const stored = toStoredVehiclePrice(25_000, "USD");
    expect(stored).toEqual({
      price: 25_000,
      listed_price: 25_000,
      price_currency: "USD",
    });
  });

  it("converts from USD with live rates even when display matches listing currency", () => {
    setExchangeRates({ GHS: 11.18204 });
    const text = formatVehiclePrice(
      { price: 10_000, priceCurrency: "GHS", listedPrice: 155_000 },
      "GHS"
    );
    // Live FX: 10_000 × 11.18204 ≈ 111,820 — not the frozen listed_price 155_000
    expect(text).toContain("111");
    expect(text).not.toContain("155");
  });

  it("converts via USD when display currency differs", () => {
    setExchangeRates({ GHS: 15.5, EUR: 0.92 });
    const text = formatVehiclePrice(
      { price: 10_000, priceCurrency: "GHS", listedPrice: 155_000 },
      "EUR"
    );
    expect(text).toContain("9");
  });

  it("prefers listedPrice for form editing", () => {
    setExchangeRates({ GHS: 15.5 });
    expect(
      listingAmountForForm({
        price: 10_000,
        priceCurrency: "GHS",
        listedPrice: 155_000,
      })
    ).toBe(155_000);
  });

  it("convertToUsd divides by rate", () => {
    setExchangeRates({ GHS: 10 });
    expect(convertToUsd(1000, "GHS")).toBe(100);
  });

  it("convertBetweenCurrencies pivots through USD", () => {
    setExchangeRates({ GHS: 10, EUR: 0.9 });
    expect(convertBetweenCurrencies(1000, "GHS", "EUR")).toBeCloseTo(90);
    expect(getCrossRate("GHS", "EUR")).toBeCloseTo(0.09);
    expect(getCrossRate("USD", "GHS")).toBe(10);
  });
});
