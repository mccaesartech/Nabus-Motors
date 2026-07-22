import { describe, expect, it } from "vitest";
import {
  colorLabelForImageUrl,
  colorLabelForPhotoId,
  countStockPhotoColorMismatches,
  normalizeColorKey,
  pexelsPhotoIdFromUrl,
  photoIdsMatchingColor,
  resolveExteriorColor,
  swatchHexForColor,
} from "@/lib/vehicles/vehicle-colors";

describe("vehicle-colors", () => {
  it("maps known Pexels stock photo ids to exterior labels", () => {
    expect(colorLabelForPhotoId(1545743)).toBe("Atomic Grey");
    expect(colorLabelForPhotoId(919073)).toBe("Obsidian Black");
    expect(colorLabelForPhotoId(1144720)).toBe("Deep Blue");
    expect(colorLabelForPhotoId(99999999)).toBeNull();
  });

  it("extracts Pexels ids and resolves color from image URLs", () => {
    const url =
      "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=998&h=541&fit=crop";
    expect(pexelsPhotoIdFromUrl(url)).toBe(1545743);
    expect(colorLabelForImageUrl(url)).toBe("Atomic Grey");
    expect(pexelsPhotoIdFromUrl("/uploads/custom-car.jpg")).toBeNull();
  });

  it("prefers stock-photo color over a mismatched stored label", () => {
    expect(
      resolveExteriorColor({
        color: "Midnight Black",
        images: [
          "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=998&h=541&fit=crop",
        ],
      })
    ).toBe("Atomic Grey");
  });

  it("keeps stored color for non-stock / unknown images", () => {
    expect(
      resolveExteriorColor({
        color: "Pearl White",
        images: ["https://res.cloudinary.com/demo/image/upload/v1/car.jpg"],
      })
    ).toBe("Pearl White");
  });

  it("prefers audited inventory photo color over a mismatched stored label", () => {
    expect(
      resolveExteriorColor({
        slug: "2020-byd-seal-performance-2",
        color: "Midnight Black",
        images: [
          "https://i.pinimg.com/736x/a8/2c/93/a82c93a256e3d88a0f21726aa698b91f.jpg",
        ],
      })
    ).toBe("Deep Blue");
  });

  it("returns swatch hex for canonical colors only", () => {
    expect(swatchHexForColor("Pearl White")).toBe("#F2F0EA");
    expect(swatchHexForColor("  midnight black ")).toBe("#1C1C1E");
    expect(swatchHexForColor("Custom Teal")).toBeNull();
  });

  it("filters photo pools by preferred color", () => {
    const ids = [1545743, 919073, 1144720, 1166754];
    expect(photoIdsMatchingColor(ids, "Deep Blue")).toEqual([1144720]);
    expect(photoIdsMatchingColor(ids, "Obsidian Black")).toEqual([919073]);
    expect(photoIdsMatchingColor(ids, "")).toEqual([]);
  });

  it("counts stock-photo label mismatches for admin reporting", () => {
    const summary = countStockPhotoColorMismatches([
      {
        color: "Midnight Black",
        images: [
          "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg",
        ],
      },
      {
        color: "Atomic Grey",
        images: [
          "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg",
        ],
      },
      {
        color: "Pearl White",
        images: ["https://cdn.example.com/real-upload.jpg"],
      },
    ]);
    expect(summary.mismatched).toBe(1);
    expect(summary.matched).toBe(1);
    expect(normalizeColorKey("Pearl  White")).toBe("pearl white");
  });
});
