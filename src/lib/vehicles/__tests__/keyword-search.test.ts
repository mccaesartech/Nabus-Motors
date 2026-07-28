import { describe, expect, it } from "vitest";
import {
  buildVehicleKeywordOrFilter,
  sanitizePublicSearchQuery,
  vehicleMatchesKeyword,
} from "@/lib/vehicles/keyword-search";
import { parseFiltersFromSearchParams } from "@/lib/vehicles/filter-params";
import type { Vehicle } from "@/lib/types";

function sampleVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "1",
    slug: "2024-toyota-rav4-xle",
    make: "Toyota",
    model: "RAV4",
    year: 2024,
    trim: "XLE",
    price: 45000,
    mileage: 12000,
    fuelType: "Petrol",
    transmission: "Automatic",
    condition: "Used",
    bodyType: "SUV",
    location: "Accra",
    engineSize: "2.5L",
    color: "White",
    vin: "JTMRWRFV0PD123456",
    description: "",
    featured: false,
    images: [],
    specs: [],
    history: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("public keyword search", () => {
  it("sanitizes empty and long queries", () => {
    expect(sanitizePublicSearchQuery("  ")).toBeUndefined();
    expect(sanitizePublicSearchQuery("toyota")?.length).toBe(6);
    expect(sanitizePublicSearchQuery("x".repeat(200))?.length).toBe(100);
  });

  it("parses q from URL params", () => {
    expect(parseFiltersFromSearchParams({ q: "  byd atto  " }).q).toBe("byd atto");
  });

  it("matches make/model/year phrases", () => {
    const v = sampleVehicle();
    expect(vehicleMatchesKeyword(v, "toyota rav4")).toBe(true);
    expect(vehicleMatchesKeyword(v, "2024 white")).toBe(true);
    expect(vehicleMatchesKeyword(v, "honda civic")).toBe(false);
  });

  it("builds an escaped PostgREST OR filter", () => {
    const filter = buildVehicleKeywordOrFilter("rav_4");
    expect(filter).toContain("make.ilike.");
    expect(filter).toContain("model.ilike.");
    expect(filter).toContain("vin.ilike.");
    // underscore is escaped for ilike, then backslash is escaped for PostgREST quoting
    expect(filter).toContain("%rav\\\\_4%");
  });

  it("adds year.eq for four-digit tokens", () => {
    expect(buildVehicleKeywordOrFilter("2024")).toContain("year.eq.2024");
  });
});
