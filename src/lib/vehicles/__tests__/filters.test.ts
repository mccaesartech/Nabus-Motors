import { describe, expect, it } from "vitest";
import { filterVehicles, parseFiltersFromSearchParams, buildFilterSearchParams } from "@/lib/vehicles";
import { applyFulfillmentExclusivity } from "@/lib/vehicles/filter-config";
import type { Vehicle } from "@/lib/types";

function baseVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "1",
    slug: "test-vehicle",
    make: "BYD",
    model: "Atto 3",
    year: 2024,
    price: 30000,
    mileage: 12000,
    fuelType: "Electric",
    transmission: "Automatic",
    condition: "New",
    bodyType: "SUV",
    location: "Accra, Ghana",
    engineSize: "Single Motor",
    color: "White",
    vin: "TEST123",
    description: "Test",
    featured: false,
    images: [],
    specs: [],
    history: [],
    status: "available",
    countryOfOrigin: "ghana",
    financingAvailable: true,
    shipmentAvailable: false,
    customsClearingAvailable: false,
    availableLocally: true,
    createdAt: "2026-01-01",
    ...overrides,
  };
}

describe("parseFiltersFromSearchParams", () => {
  it("parses fulfillment mode from new param", () => {
    const filters = parseFiltersFromSearchParams({ fulfillment: "in_ghana" });
    expect(filters.fulfillmentMode).toBe("in_ghana");
    expect(filters.availableLocally).toBe(true);
  });

  it("maps legacy available_locally param", () => {
    const filters = parseFiltersFromSearchParams({ available_locally: "1" });
    expect(filters.fulfillmentMode).toBe("in_ghana");
  });

  it("sanitizes invalid body type", () => {
    const filters = parseFiltersFromSearchParams({ bodyType: "InvalidType" });
    expect(filters.bodyType).toBeUndefined();
  });

  it("parses trust badge list", () => {
    const filters = parseFiltersFromSearchParams({
      trust: "verified_by_true_goshen,genuine_listing,not_real",
    });
    expect(filters.trustBadges).toEqual([
      "verified_by_true_goshen",
      "genuine_listing",
    ]);
  });
});

describe("applyFulfillmentExclusivity", () => {
  it("clears conflicting flags when import mode selected", () => {
    const result = applyFulfillmentExclusivity(
      { availableLocally: true, status: "available" },
      "import_ship"
    );
    expect(result.shipmentAvailable).toBe(true);
    expect(result.availableLocally).toBeUndefined();
    expect(result.status).toBeUndefined();
  });
});

describe("filterVehicles", () => {
  const inventory = [
    baseVehicle({ id: "1", availableLocally: true, shipmentAvailable: false }),
    baseVehicle({
      id: "2",
      location: "Shanghai, China",
      countryOfOrigin: "china",
      availableLocally: false,
      shipmentAvailable: true,
    }),
    baseVehicle({
      id: "3",
      status: "pre_order",
      availableLocally: false,
      shipmentAvailable: true,
    }),
  ];

  it("filters in-ghana fulfillment without contradictory import stock", () => {
    const filtered = filterVehicles(inventory, {
      fulfillmentMode: "in_ghana",
      availableLocally: true,
    });
    expect(filtered.map((v) => v.id)).toEqual(["1"]);
  });

  it("filters import/ship listings", () => {
    const filtered = filterVehicles(inventory, {
      fulfillmentMode: "import_ship",
      shipmentAvailable: true,
    });
    expect(filtered.map((v) => v.id)).toEqual(["2"]);
  });

  it("filters pre-order only", () => {
    const filtered = filterVehicles(inventory, {
      fulfillmentMode: "pre_order_only",
      status: "pre_order",
    });
    expect(filtered.map((v) => v.id)).toEqual(["3"]);
  });

  it("round-trips fulfillment through URL params", () => {
    const built = buildFilterSearchParams({
      fulfillmentMode: "import_ship",
      shipmentAvailable: true,
    });
    const parsed = parseFiltersFromSearchParams(Object.fromEntries(built.entries()));
    expect(parsed.fulfillmentMode).toBe("import_ship");
    expect(parsed.shipmentAvailable).toBe(true);
    expect(parsed.availableLocally).toBeUndefined();
  });
});
