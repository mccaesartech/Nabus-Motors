import { describe, expect, it } from "vitest";
import {
  isGhanaLocatedVehicle,
  isLocallyAvailableForBanner,
} from "@/lib/vehicles/local-availability";

describe("local-availability", () => {
  it("detects Ghana-located vehicles by origin", () => {
    expect(
      isGhanaLocatedVehicle({
        countryOfOrigin: "ghana",
        location: "Shanghai",
        status: "available",
        availableLocally: false,
      })
    ).toBe(true);
  });

  it("detects Ghana-located vehicles by location text", () => {
    expect(
      isGhanaLocatedVehicle({
        countryOfOrigin: "china",
        location: "Accra, Ghana",
        status: "available",
        availableLocally: false,
      })
    ).toBe(true);
  });

  it("excludes sold vehicles from local banner", () => {
    expect(
      isLocallyAvailableForBanner({
        countryOfOrigin: "ghana",
        location: "Accra, Ghana",
        status: "sold",
        availableLocally: true,
      })
    ).toBe(false);
  });

  it("includes admin-flagged local arrivals", () => {
    expect(
      isLocallyAvailableForBanner({
        countryOfOrigin: "china",
        location: "Shanghai",
        status: "available",
        availableLocally: true,
      })
    ).toBe(true);
  });

  it("includes in-stock Ghana inventory without explicit flag", () => {
    expect(
      isLocallyAvailableForBanner({
        countryOfOrigin: "ghana",
        location: "Kumasi, Ghana",
        status: "available",
        availableLocally: false,
      })
    ).toBe(true);
  });
});
