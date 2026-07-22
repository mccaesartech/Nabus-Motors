import { describe, expect, it } from "vitest";
import {
  bodyHasSpecFormFields,
  buildVehicleSpecs,
  extractSpecFormFields,
  formatHorsepowerSpecValue,
  formatSeatingSpecValue,
  parseSeatingCapacity,
} from "@/lib/admin/vehicle-specs";
import { rowFromInput } from "@/lib/admin/vehicle-mapper";
import { ADMIN_VEHICLE_SELECT_FULL, ADMIN_VEHICLE_SELECT_SAFE } from "@/lib/admin/vehicle-columns";

describe("parseSeatingCapacity", () => {
  it("parses passenger strings", () => {
    expect(parseSeatingCapacity("7 passengers")).toBe(7);
    expect(parseSeatingCapacity("5")).toBe(5);
    expect(parseSeatingCapacity("")).toBeUndefined();
  });
});

describe("buildVehicleSpecs", () => {
  it("persists seating capacity as Seating spec", () => {
    const specs = buildVehicleSpecs({
      seating_capacity: 7,
      drivetrain: "AWD",
      horsepower: "211",
      range: "450 km CLTC",
    });
    expect(specs).toEqual([
      { label: "Drivetrain", value: "AWD" },
      { label: "Horsepower", value: "211 hp" },
      { label: "Seating", value: "7 passengers" },
      { label: "Range", value: "450 km CLTC" },
    ]);
  });

  it("omits empty seating and preserves custom specs", () => {
    const specs = buildVehicleSpecs({
      seating_capacity: null,
      drivetrain: "",
      specs: [
        { label: "Seating", value: "5 passengers" },
        { label: "Cargo", value: "450 L" },
      ],
    });
    expect(specs).toEqual([{ label: "Cargo", value: "450 L" }]);
  });

  it("round-trips through extractSpecFormFields", () => {
    const built = buildVehicleSpecs({
      seating_capacity: 5,
      drivetrain: "FWD",
      horsepower: "155 hp",
    });
    expect(extractSpecFormFields(built)).toEqual({
      seating_capacity: 5,
      drivetrain: "FWD",
      horsepower: "155 hp",
      range: "",
    });
  });
});

describe("format helpers", () => {
  it("formats seating and horsepower consistently", () => {
    expect(formatSeatingSpecValue(5)).toBe("5 passengers");
    expect(formatHorsepowerSpecValue("302")).toBe("302 hp");
    expect(formatHorsepowerSpecValue("302 hp")).toBe("302 hp");
  });
});

describe("bodyHasSpecFormFields", () => {
  it("detects seating and related fields for PATCH allowlist wiring", () => {
    expect(bodyHasSpecFormFields({ seating_capacity: 5 })).toBe(true);
    expect(bodyHasSpecFormFields({ make: "BYD" })).toBe(false);
    expect(bodyHasSpecFormFields({ specs: [] })).toBe(true);
  });
});

describe("rowFromInput specs", () => {
  it("writes seating into specs instead of wiping them", () => {
    const row = rowFromInput(
      {
        make: "BYD",
        model: "Atto 3",
        year: 2024,
        price: 25000,
        mileage: 1000,
        fuel_type: "Electric",
        transmission: "Automatic",
        condition: "New",
        body_type: "SUV",
        location: "Accra, Ghana",
        seating_capacity: 5,
        drivetrain: "FWD",
        horsepower: "201 hp",
        range: "420 km CLTC",
      },
      "2024-byd-atto-3-test"
    );
    expect(row.specs).toEqual([
      { label: "Drivetrain", value: "FWD" },
      { label: "Horsepower", value: "201 hp" },
      { label: "Seating", value: "5 passengers" },
      { label: "Range", value: "420 km CLTC" },
    ]);
  });

  it("clears shipment_available when available_locally is set", () => {
    const row = rowFromInput(
      {
        make: "BYD",
        model: "Atto 3",
        year: 2024,
        price: 25000,
        mileage: 1000,
        fuel_type: "Electric",
        transmission: "Automatic",
        condition: "New",
        body_type: "SUV",
        location: "Accra, Ghana",
        available_locally: true,
        shipment_available: true,
      },
      "2024-byd-atto-3-local"
    );
    expect(row.available_locally).toBe(true);
    expect(row.shipment_available).toBe(false);
  });
});

describe("admin select includes specs", () => {
  it("includes specs in full and safe select lists", () => {
    expect(ADMIN_VEHICLE_SELECT_FULL).toContain("specs");
    expect(ADMIN_VEHICLE_SELECT_SAFE).toContain("specs");
  });
});
