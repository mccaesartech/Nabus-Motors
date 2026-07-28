import { describe, expect, it } from "vitest";
import { setExchangeRates } from "@/lib/currency/rates";
import {
  convertToUsd,
  formatVehiclePrice,
  listingAmountForForm,
  toStoredVehiclePrice,
} from "@/lib/currency/listing";

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

  it("shows exact listed amount when display matches listing currency", () => {
    setExchangeRates({ GHS: 15.5 });
    const text = formatVehiclePrice(
      { price: 10_000, priceCurrency: "GHS", listedPrice: 155_000 },
      "GHS"
    );
    expect(text).toContain("155");
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
});
