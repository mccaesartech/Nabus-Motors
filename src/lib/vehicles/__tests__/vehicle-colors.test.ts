import { describe, expect, it } from "vitest";
import {
  colorLabelForImageUrl,
  colorLabelForPhotoId,
  countStockPhotoColorMismatches,
  filterVehicleColorOptions,
  findVehicleColorOption,
  groupedVehicleColorOptions,
  normalizeColorKey,
  pexelsPhotoIdFromUrl,
  photoIdsMatchingColor,
  resolveExteriorColor,
  swatchEdgeClass,
  swatchHexForColor,
  swatchLuminance,
  VEHICLE_COLOR_OPTIONS,
} from "@/lib/vehicles/vehicle-colors";

/** Every unique named color from the COLORS AND THEIR NAMES chart. */
const CHART_COLOR_NAMES = [
  // Reds
  "Red",
  "Crimson",
  "Scarlet",
  "Maroon",
  "Burgundy",
  "Ruby",
  "Cherry",
  "Rose Red",
  "Brick Red",
  "Wine Red",
  "Carmine",
  "Vermilion",
  // Oranges
  "Orange",
  "Amber",
  "Tangerine",
  "Burnt Orange",
  "Pumpkin",
  "Peach",
  "Apricot",
  "Copper",
  "Rust",
  "Persimmon",
  // Yellows
  "Yellow",
  "Gold",
  "Mustard",
  "Lemon",
  "Canary",
  "Cream",
  "Ivory",
  "Khaki",
  "Sand",
  "Beige",
  // Greens
  "Green",
  "Emerald",
  "Forest Green",
  "Olive",
  "Lime",
  "Mint",
  "Sage",
  "Moss",
  "Sea Green",
  "Jade",
  "Pistachio",
  "Teal",
  "Hunter Green",
  // Blues
  "Blue",
  "Navy",
  "Royal Blue",
  "Sky Blue",
  "Baby Blue",
  "Azure",
  "Cobalt",
  "Sapphire",
  "Turquoise",
  "Cyan",
  "Aqua",
  "Steel Blue",
  "Powder Blue",
  // Purples
  "Purple",
  "Violet",
  "Lavender",
  "Lilac",
  "Plum",
  "Orchid",
  "Indigo",
  "Amethyst",
  "Magenta",
  "Mulberry",
  // Pinks
  "Pink",
  "Hot Pink",
  "Baby Pink",
  "Blush",
  "Rose Pink",
  "Salmon",
  "Fuchsia",
  "Bubblegum",
  "Dusty Pink",
  // Browns
  "Brown",
  "Chocolate",
  "Coffee",
  "Walnut",
  "Mahogany",
  "Chestnut",
  "Tan",
  "Camel",
  "Mocha",
  "Cocoa",
  "Bronze",
  "Sepia",
  // Neutrals
  "Black",
  "Charcoal",
  "Graphite",
  "Gray",
  "Slate",
  "Silver",
  "White",
  "Off-White",
  "Taupe",
  "Stone",
  "Ash",
  "Smoke",
  // Other popular (unique labels only)
  "Coral",
  "Pearl",
  "Lime Green",
  "Kelly Green",
  "Jade Green",
  "Ube",
  "Periwinkle",
  "Raspberry",
  "Grape",
  "Charcoal Gray",
] as const;

describe("vehicle-colors", () => {
  it("exposes a broad named palette with hex swatches", () => {
    expect(VEHICLE_COLOR_OPTIONS.length).toBe(111);
    for (const opt of VEHICLE_COLOR_OPTIONS) {
      expect(opt.label.trim().length).toBeGreaterThan(0);
      expect(opt.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(opt.group.length).toBeGreaterThan(0);
    }
    const labels = VEHICLE_COLOR_OPTIONS.map((o) => normalizeColorKey(o.label));
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("includes every unique name from the color chart", () => {
    const labels = new Set(VEHICLE_COLOR_OPTIONS.map((o) => o.label));
    const missing = CHART_COLOR_NAMES.filter((name) => !labels.has(name));
    expect(missing).toEqual([]);
    expect(CHART_COLOR_NAMES).toHaveLength(111);
  });

  it("filters palette options by search query", () => {
    expect(filterVehicleColorOptions("").map((o) => o.label)).toHaveLength(111);
    expect(filterVehicleColorOptions("  ").map((o) => o.label)).toHaveLength(111);
    expect(filterVehicleColorOptions("blue").map((o) => o.label)).toEqual([
      "Blue",
      "Royal Blue",
      "Sky Blue",
      "Baby Blue",
      "Steel Blue",
      "Powder Blue",
    ]);
    expect(filterVehicleColorOptions("PERI").map((o) => o.label)).toEqual(["Periwinkle"]);
    expect(filterVehicleColorOptions("zzz").map((o) => o.label)).toEqual([]);
    const filteredGroups = groupedVehicleColorOptions(filterVehicleColorOptions("green"));
    expect(filteredGroups.map((g) => g.group)).toEqual(["Greens", "Other"]);
    expect(filteredGroups.find((g) => g.group === "Greens")?.options.map((o) => o.label)).toEqual(
      expect.arrayContaining(["Green", "Forest Green", "Hunter Green"])
    );
  });

  it("groups palette options by chart categories", () => {
    const groups = groupedVehicleColorOptions();
    expect(groups.map((g) => g.group)).toEqual([
      "Reds",
      "Oranges",
      "Yellows",
      "Greens",
      "Blues",
      "Purples",
      "Pinks",
      "Browns",
      "Neutrals",
      "Other",
    ]);
    expect(groups.flatMap((g) => g.options)).toHaveLength(VEHICLE_COLOR_OPTIONS.length);
    expect(groups.find((g) => g.group === "Reds")?.options.map((o) => o.label)).toContain(
      "Vermilion"
    );
    expect(groups.find((g) => g.group === "Other")?.options.map((o) => o.label)).toEqual(
      expect.arrayContaining(["Coral", "Pearl", "Ube", "Periwinkle", "Charcoal Gray"])
    );
  });

  it("picks stronger swatch edges for very light and very dark paints", () => {
    expect(swatchLuminance("#FFFFFF")).toBeGreaterThan(0.8);
    expect(swatchLuminance("#000000")).toBeLessThan(0.2);
    expect(swatchEdgeClass("#FFFFFF")).toBe("border-black/35");
    expect(swatchEdgeClass("#000000")).toBe("border-black/45");
    expect(swatchEdgeClass("#0056D7")).toBe("border-black/20");
  });

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
        color: "Pearl",
        images: ["https://res.cloudinary.com/demo/image/upload/v1/car.jpg"],
      })
    ).toBe("Pearl");
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

  it("returns swatch hex for canonical colors and aliases", () => {
    expect(swatchHexForColor("Pearl")).toBe("#EAE0C8");
    expect(swatchHexForColor("pearl white")).toBe("#EAE0C8");
    expect(swatchHexForColor("  midnight black ")).toBe("#000000");
    expect(swatchHexForColor("White")).toBe("#FFFFFF");
    expect(swatchHexForColor("Cherry")).toBe("#D2042D");
    expect(swatchHexForColor("Cherry Red")).toBe("#D2042D");
    expect(swatchHexForColor("Ruby")).toBe("#E0115F");
    expect(swatchHexForColor("Cocoa")).toBe("#D2691E");
    expect(swatchHexForColor("Custom Teal")).toBeNull();
  });

  it("resolves color options case-insensitively and via aliases", () => {
    expect(findVehicleColorOption("pearl")?.label).toBe("Pearl");
    expect(findVehicleColorOption("pearl white")?.label).toBe("Pearl");
    expect(findVehicleColorOption("metallic silver")?.label).toBe("Silver");
    expect(findVehicleColorOption("BLACK")?.label).toBe("Black");
    expect(findVehicleColorOption("grey")?.label).toBe("Gray");
    expect(findVehicleColorOption("navy blue")?.label).toBe("Navy");
    expect(findVehicleColorOption("deep blue")?.label).toBe("Navy");
    expect(findVehicleColorOption("Alpine White")).toBeUndefined();
  });

  it("filters photo pools by preferred color using alias-aware matching", () => {
    const ids = [1545743, 919073, 1144720, 1166754];
    expect(photoIdsMatchingColor(ids, "Deep Blue")).toEqual([1144720]);
    expect(photoIdsMatchingColor(ids, "Navy")).toEqual([1144720]);
    expect(photoIdsMatchingColor(ids, "Obsidian Black")).toEqual([919073]);
    expect(photoIdsMatchingColor(ids, "Black")).toEqual([919073]);
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
        color: "Pearl",
        images: ["https://cdn.example.com/real-upload.jpg"],
      },
    ]);
    expect(summary.mismatched).toBe(1);
    expect(summary.matched).toBe(1);
    expect(normalizeColorKey("Pearl  White")).toBe("pearl white");
  });
});
