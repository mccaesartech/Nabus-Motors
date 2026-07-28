import { describe, expect, it } from "vitest";
import {
  availableCountForVehicle,
  buildAvailableStockCounts,
  buildFleetLowStockMessage,
  fleetIsLowStock,
  isModelLowStock,
  listLowStockGroups,
  modelStockLevel,
  shouldHighlightVehicleStock,
  stockGroupKey,
} from "@/lib/vehicles/low-stock";

describe("stockGroupKey", () => {
  it("normalizes make/model casing and trim", () => {
    expect(stockGroupKey(" Toyota ", "Camry", 2024)).toBe("toyota|camry|2024");
  });
});

describe("buildAvailableStockCounts / model stock", () => {
  const vehicles = [
    { make: "Toyota", model: "Camry", year: 2024, status: "available" },
    { make: "Toyota", model: "Camry", year: 2024, status: "available" },
    { make: "Toyota", model: "Camry", year: 2024, status: "sold" },
    { make: "Honda", model: "Civic", year: 2023, status: "available" },
    { make: "Ford", model: "Ranger", year: 2022, status: "pre_order" },
  ];

  it("counts only available units per make/model/year", () => {
    const counts = buildAvailableStockCounts(vehicles);
    expect(counts.get(stockGroupKey("Toyota", "Camry", 2024))).toBe(2);
    expect(counts.get(stockGroupKey("Honda", "Civic", 2023))).toBe(1);
    expect(counts.get(stockGroupKey("Ford", "Ranger", 2022)) ?? 0).toBe(0);
  });

  it("flags last unit as low and zero as out", () => {
    expect(modelStockLevel(2)).toBe("ok");
    expect(modelStockLevel(1)).toBe("low");
    expect(modelStockLevel(0)).toBe("out");
    expect(isModelLowStock(1)).toBe(true);
    expect(isModelLowStock(2)).toBe(false);
  });

  it("highlights available/pre_order rows in low groups only", () => {
    const counts = buildAvailableStockCounts(vehicles);
    expect(
      shouldHighlightVehicleStock(
        { make: "Honda", model: "Civic", year: 2023, status: "available" },
        counts
      )
    ).toBe(true);
    expect(
      shouldHighlightVehicleStock(
        { make: "Toyota", model: "Camry", year: 2024, status: "available" },
        counts
      )
    ).toBe(false);
    expect(
      shouldHighlightVehicleStock(
        { make: "Ford", model: "Ranger", year: 2022, status: "pre_order" },
        counts
      )
    ).toBe(true);
    expect(
      shouldHighlightVehicleStock(
        { make: "Toyota", model: "Camry", year: 2024, status: "sold" },
        counts
      )
    ).toBe(false);
  });

  it("lists low stock groups with active listings", () => {
    const counts = buildAvailableStockCounts(vehicles);
    const groups = listLowStockGroups(vehicles, counts);
    expect(groups.map((g) => g.key).sort()).toEqual(
      [
        stockGroupKey("Ford", "Ranger", 2022),
        stockGroupKey("Honda", "Civic", 2023),
      ].sort()
    );
    expect(availableCountForVehicle(vehicles[3], counts)).toBe(1);
  });
});

describe("fleet low stock messaging", () => {
  it("uses threshold with add/import suggestion", () => {
    expect(fleetIsLowStock(4, 5, true)).toBe(true);
    expect(fleetIsLowStock(5, 5, true)).toBe(false);
    expect(fleetIsLowStock(0, 5, false)).toBe(false);
    expect(buildFleetLowStockMessage(2, 5)).toMatch(/Only 2 vehicles available/);
    expect(buildFleetLowStockMessage(2, 5)).toMatch(/importing|Pre-order|Ghana/i);
  });
});
