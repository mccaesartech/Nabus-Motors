import { describe, expect, it } from "vitest";
import {
  buildVehiclePublishSummary,
  listingImageUrls,
  requirePrimaryVehicleImage,
  rolePublishesImmediately,
} from "@/lib/admin/vehicle-publish-gates";

describe("vehicle-publish-gates", () => {
  it("requires a primary vehicle photo", () => {
    expect(requirePrimaryVehicleImage({})).toMatch(/photo/i);
    expect(
      requirePrimaryVehicleImage({
        primary_image_url: "https://cdn.example.com/car.jpg",
        images: ["https://cdn.example.com/car.jpg"],
      })
    ).toBeNull();
  });

  it("collects listing image urls without duplicates", () => {
    const urls = listingImageUrls({
      primary_image_url: "https://cdn.example.com/a.jpg",
      additional_images: ["https://cdn.example.com/b.jpg", "https://cdn.example.com/a.jpg"],
      images: ["https://cdn.example.com/c.jpg"],
    });
    expect(urls).toEqual([
      "https://cdn.example.com/a.jpg",
      "https://cdn.example.com/b.jpg",
      "https://cdn.example.com/c.jpg",
    ]);
  });

  it("builds a publish summary", () => {
    const summary = buildVehiclePublishSummary({
      year: 2024,
      make: "Toyota",
      model: "Camry",
      trim: "XSE",
      price: 25000,
      mileage: 12000,
      color: "White",
      status: "available",
      location: "Accra",
      body_type: "Sedan",
      fuel_type: "Petrol",
      transmission: "Automatic",
      condition: "Used",
      primary_image_url: "https://cdn.example.com/a.jpg",
      featured: true,
    });
    expect(summary.title).toBe("2024 Toyota Camry XSE");
    expect(summary.photoCount).toBe(1);
    expect(summary.statusLabel).toBeTruthy();
    expect(summary.priceCurrency).toBe("GHS");
  });

  it("detects roles that publish immediately", () => {
    expect(rolePublishesImmediately("owner")).toBe(true);
    expect(rolePublishesImmediately("super_admin")).toBe(true);
    expect(rolePublishesImmediately("manager")).toBe(false);
    expect(rolePublishesImmediately("staff")).toBe(false);
  });
});
