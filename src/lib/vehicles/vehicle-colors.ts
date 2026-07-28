/**
 * Canonical exterior colors + swatches for inventory display and admin editors.
 * Stock Pexels placeholders are annotated in car-photo-colors.json so labels
 * match the cars shown in those images.
 */

import photoColors from "@/lib/data/car-photo-colors.json";
import inventoryPhotoColors from "@/lib/data/inventory-photo-colors.json";

export type VehicleColorGroup =
  | "Reds"
  | "Oranges"
  | "Yellows"
  | "Greens"
  | "Blues"
  | "Purples"
  | "Pinks"
  | "Browns"
  | "Neutrals"
  | "Other";

export type VehicleColorOption = {
  label: string;
  hex: string;
  group: VehicleColorGroup;
};

const INVENTORY_PHOTO_COLOR_BY_SLUG = inventoryPhotoColors as Record<string, string>;

const COLOR_GROUP_ORDER: readonly VehicleColorGroup[] = [
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
] as const;

/** Canonical exterior colors used in seed, admin, and swatches. */
export const VEHICLE_COLOR_OPTIONS: readonly VehicleColorOption[] = [
  // Reds
  { label: "Red", hex: "#E30613", group: "Reds" },
  { label: "Crimson", hex: "#DC143C", group: "Reds" },
  { label: "Scarlet", hex: "#FF2400", group: "Reds" },
  { label: "Maroon", hex: "#800000", group: "Reds" },
  { label: "Burgundy", hex: "#800020", group: "Reds" },
  { label: "Ruby", hex: "#E0115F", group: "Reds" },
  { label: "Cherry", hex: "#D2042D", group: "Reds" },
  { label: "Rose Red", hex: "#C21E56", group: "Reds" },
  { label: "Brick Red", hex: "#CB4154", group: "Reds" },
  { label: "Wine Red", hex: "#722F37", group: "Reds" },
  { label: "Carmine", hex: "#D70040", group: "Reds" },
  { label: "Vermilion", hex: "#E34234", group: "Reds" },

  // Oranges
  { label: "Orange", hex: "#FFA500", group: "Oranges" },
  { label: "Amber", hex: "#FFBF00", group: "Oranges" },
  { label: "Tangerine", hex: "#F28500", group: "Oranges" },
  { label: "Burnt Orange", hex: "#CC5500", group: "Oranges" },
  { label: "Pumpkin", hex: "#FF7518", group: "Oranges" },
  { label: "Peach", hex: "#FFDAB9", group: "Oranges" },
  { label: "Apricot", hex: "#FBCEB1", group: "Oranges" },
  { label: "Copper", hex: "#B87333", group: "Oranges" },
  { label: "Rust", hex: "#B7410E", group: "Oranges" },
  { label: "Persimmon", hex: "#EC5800", group: "Oranges" },

  // Yellows
  { label: "Yellow", hex: "#FFFF00", group: "Yellows" },
  { label: "Gold", hex: "#FFD700", group: "Yellows" },
  { label: "Mustard", hex: "#FFDB58", group: "Yellows" },
  { label: "Lemon", hex: "#FFF700", group: "Yellows" },
  { label: "Canary", hex: "#FFEF00", group: "Yellows" },
  { label: "Cream", hex: "#FFFDD0", group: "Yellows" },
  { label: "Ivory", hex: "#FFFFF0", group: "Yellows" },
  { label: "Khaki", hex: "#C3B091", group: "Yellows" },
  { label: "Sand", hex: "#C2B280", group: "Yellows" },
  { label: "Beige", hex: "#F5F5DC", group: "Yellows" },

  // Greens
  { label: "Green", hex: "#008000", group: "Greens" },
  { label: "Emerald", hex: "#50C878", group: "Greens" },
  { label: "Forest Green", hex: "#228B22", group: "Greens" },
  { label: "Olive", hex: "#808000", group: "Greens" },
  { label: "Lime", hex: "#00FF00", group: "Greens" },
  { label: "Mint", hex: "#98FF98", group: "Greens" },
  { label: "Sage", hex: "#BCB88A", group: "Greens" },
  { label: "Moss", hex: "#8A9A5B", group: "Greens" },
  { label: "Sea Green", hex: "#2E8B57", group: "Greens" },
  { label: "Jade", hex: "#00A86B", group: "Greens" },
  { label: "Pistachio", hex: "#93C572", group: "Greens" },
  { label: "Teal", hex: "#008080", group: "Greens" },
  { label: "Hunter Green", hex: "#355E3B", group: "Greens" },

  // Blues
  { label: "Blue", hex: "#0056D7", group: "Blues" },
  { label: "Navy", hex: "#000080", group: "Blues" },
  { label: "Royal Blue", hex: "#4169E1", group: "Blues" },
  { label: "Sky Blue", hex: "#87CEEB", group: "Blues" },
  { label: "Baby Blue", hex: "#89CFF0", group: "Blues" },
  { label: "Azure", hex: "#007FFF", group: "Blues" },
  { label: "Cobalt", hex: "#0047AB", group: "Blues" },
  { label: "Sapphire", hex: "#0F52BA", group: "Blues" },
  { label: "Turquoise", hex: "#40E0D0", group: "Blues" },
  { label: "Cyan", hex: "#00FFFF", group: "Blues" },
  { label: "Aqua", hex: "#00FFFF", group: "Blues" },
  { label: "Steel Blue", hex: "#4682B4", group: "Blues" },
  { label: "Powder Blue", hex: "#B0E0E6", group: "Blues" },

  // Purples
  { label: "Purple", hex: "#800080", group: "Purples" },
  { label: "Violet", hex: "#8F00FF", group: "Purples" },
  { label: "Lavender", hex: "#E6E6FA", group: "Purples" },
  { label: "Lilac", hex: "#C8A2C8", group: "Purples" },
  { label: "Plum", hex: "#8E4585", group: "Purples" },
  { label: "Orchid", hex: "#DA70D6", group: "Purples" },
  { label: "Indigo", hex: "#4B0082", group: "Purples" },
  { label: "Amethyst", hex: "#9966CC", group: "Purples" },
  { label: "Magenta", hex: "#FF00FF", group: "Purples" },
  { label: "Mulberry", hex: "#C54B8C", group: "Purples" },

  // Pinks
  { label: "Pink", hex: "#FFC0CB", group: "Pinks" },
  { label: "Hot Pink", hex: "#FF69B4", group: "Pinks" },
  { label: "Baby Pink", hex: "#F4C2C2", group: "Pinks" },
  { label: "Blush", hex: "#DE5D83", group: "Pinks" },
  { label: "Rose Pink", hex: "#FF66CC", group: "Pinks" },
  { label: "Salmon", hex: "#FA8072", group: "Pinks" },
  { label: "Fuchsia", hex: "#FF00FF", group: "Pinks" },
  { label: "Bubblegum", hex: "#FFC1CC", group: "Pinks" },
  { label: "Dusty Pink", hex: "#DCAE96", group: "Pinks" },

  // Browns
  { label: "Brown", hex: "#964B00", group: "Browns" },
  { label: "Chocolate", hex: "#7B3F00", group: "Browns" },
  { label: "Coffee", hex: "#6F4E37", group: "Browns" },
  { label: "Walnut", hex: "#5D3954", group: "Browns" },
  { label: "Mahogany", hex: "#C04000", group: "Browns" },
  { label: "Chestnut", hex: "#954535", group: "Browns" },
  { label: "Tan", hex: "#D2B48C", group: "Browns" },
  { label: "Camel", hex: "#C19A6B", group: "Browns" },
  { label: "Mocha", hex: "#A38068", group: "Browns" },
  { label: "Cocoa", hex: "#D2691E", group: "Browns" },
  { label: "Bronze", hex: "#CD7F32", group: "Browns" },
  { label: "Sepia", hex: "#704214", group: "Browns" },

  // Neutrals
  { label: "Black", hex: "#000000", group: "Neutrals" },
  { label: "Charcoal", hex: "#36454F", group: "Neutrals" },
  { label: "Graphite", hex: "#383838", group: "Neutrals" },
  { label: "Gray", hex: "#808080", group: "Neutrals" },
  { label: "Slate", hex: "#708090", group: "Neutrals" },
  { label: "Silver", hex: "#C0C0C0", group: "Neutrals" },
  { label: "White", hex: "#FFFFFF", group: "Neutrals" },
  { label: "Off-White", hex: "#FAF9F6", group: "Neutrals" },
  { label: "Taupe", hex: "#483C32", group: "Neutrals" },
  { label: "Stone", hex: "#877974", group: "Neutrals" },
  { label: "Ash", hex: "#B2BEB5", group: "Neutrals" },
  { label: "Smoke", hex: "#738276", group: "Neutrals" },

  // Other popular (unique names not already in main groups)
  { label: "Coral", hex: "#FF7F50", group: "Other" },
  { label: "Pearl", hex: "#EAE0C8", group: "Other" },
  { label: "Lime Green", hex: "#32CD32", group: "Other" },
  { label: "Kelly Green", hex: "#4CBB17", group: "Other" },
  { label: "Jade Green", hex: "#00A86B", group: "Other" },
  { label: "Ube", hex: "#8878C3", group: "Other" },
  { label: "Periwinkle", hex: "#CCCCFF", group: "Other" },
  { label: "Raspberry", hex: "#E30B5D", group: "Other" },
  { label: "Grape", hex: "#6F2DA8", group: "Other" },
  { label: "Charcoal Gray", hex: "#333333", group: "Other" },
] as const;

/**
 * Legacy / OEM-adjacent labels → canonical palette labels.
 * Keeps stock photo maps, AI suggestions, and older inventory rows resolvable.
 */
const COLOR_ALIASES: Readonly<Record<string, string>> = {
  // Spelling
  grey: "Gray",
  "charcoal grey": "Charcoal Gray",
  "charcoal gray": "Charcoal Gray",
  "ube (purple)": "Ube",

  // Former Whites / silvers / greys / blacks
  "pearl white": "Pearl",
  "metallic silver": "Silver",
  "metallic white": "White",
  "silver frost": "Silver",
  "platinum silver": "Silver",
  "atomic grey": "Gray",
  "atomic gray": "Gray",
  "storm grey": "Slate",
  "storm gray": "Slate",
  "graphite grey": "Graphite",
  "graphite gray": "Graphite",
  "gunmetal grey": "Charcoal",
  "gunmetal gray": "Charcoal",
  "midnight black": "Black",
  "obsidian black": "Black",
  "phantom black": "Black",
  "gloss black": "Black",

  // Former blues / greens
  "ice blue": "Powder Blue",
  "ocean blue": "Azure",
  "deep blue": "Navy",
  "navy blue": "Navy",
  "olive green": "Olive",
  "emerald green": "Emerald",
  "deep green": "Hunter Green",

  // Former yellows / oranges / reds / browns
  "solar yellow": "Yellow",
  "copper orange": "Copper",
  "cherry red": "Cherry",
  "crimson red": "Crimson",
  "radiant red": "Scarlet",
  "mocha brown": "Mocha",
  "champagne gold": "Gold",
  "rose gold": "Rose Pink",
};

/** Case-insensitive substring filter for the color picker search box. */
export function filterVehicleColorOptions(
  query: string,
  options: readonly VehicleColorOption[] = VEHICLE_COLOR_OPTIONS
): VehicleColorOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...options];
  return options.filter((opt) => opt.label.toLowerCase().includes(q));
}

/** Palette options grouped for admin pickers (name + hex swatch per row). */
export function groupedVehicleColorOptions(
  options: readonly VehicleColorOption[] = VEHICLE_COLOR_OPTIONS
): Array<{ group: VehicleColorGroup; options: VehicleColorOption[] }> {
  const byGroup = new Map<VehicleColorGroup, VehicleColorOption[]>();
  for (const group of COLOR_GROUP_ORDER) {
    byGroup.set(group, []);
  }
  for (const opt of options) {
    const bucket = byGroup.get(opt.group);
    if (bucket) bucket.push(opt);
    else byGroup.set(opt.group, [opt]);
  }
  return COLOR_GROUP_ORDER.map((group) => ({
    group,
    options: byGroup.get(group) ?? [],
  })).filter((entry) => entry.options.length > 0);
}

/** Relative luminance 0–1 for choosing a visible swatch edge. */
export function swatchLuminance(hex: string): number {
  const raw = hex.trim().replace(/^#/, "");
  if (raw.length !== 6) return 0.5;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) return 0.5;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Border class so white/silver and near-black chips stay visible on white UI. */
export function swatchEdgeClass(hex: string): string {
  const lum = swatchLuminance(hex);
  if (lum >= 0.82) return "border-black/35";
  if (lum <= 0.18) return "border-black/45";
  return "border-black/20";
}

export function normalizeColorKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

const OPTIONS_BY_NORMALIZED = new Map(
  VEHICLE_COLOR_OPTIONS.map((opt) => [normalizeColorKey(opt.label), opt])
);

const PHOTO_COLOR_BY_ID = photoColors as Record<string, string>;

/** Resolve a stored color string to a canonical option (case/spacing insensitive). */
export function findVehicleColorOption(
  value: string | null | undefined
): VehicleColorOption | undefined {
  if (!value?.trim()) return undefined;
  const key = normalizeColorKey(value);
  const direct = OPTIONS_BY_NORMALIZED.get(key);
  if (direct) return direct;
  const aliasTarget = COLOR_ALIASES[key];
  if (!aliasTarget) return undefined;
  return OPTIONS_BY_NORMALIZED.get(normalizeColorKey(aliasTarget));
}

export function isCanonicalVehicleColor(value: string): boolean {
  return findVehicleColorOption(value) != null;
}

export function swatchHexForColor(color: string | null | undefined): string | null {
  if (!color?.trim()) return null;
  return findVehicleColorOption(color)?.hex ?? null;
}

export function colorLabelForPhotoId(photoId: number | string | null | undefined): string | null {
  if (photoId == null || photoId === "") return null;
  const label = PHOTO_COLOR_BY_ID[String(photoId)];
  return label?.trim() || null;
}

/** Extract a Pexels photo id from a stock image URL, if present. */
export function pexelsPhotoIdFromUrl(url: string | null | undefined): number | null {
  if (!url?.trim()) return null;
  const match = url.match(/pexels\.com\/photos\/(\d+)\//i);
  if (!match) return null;
  const id = Number.parseInt(match[1], 10);
  return Number.isFinite(id) ? id : null;
}

export function colorLabelForImageUrl(url: string | null | undefined): string | null {
  return colorLabelForPhotoId(pexelsPhotoIdFromUrl(url));
}

function primaryImageCandidate(vehicle: {
  color?: string | null;
  primaryImageUrl?: string | null;
  primary_image_url?: string | null;
  additionalImages?: string[] | null;
  additional_images?: string[] | null;
  gallery?: { exterior?: string[] } | null;
  images?: string[] | null;
}): string | undefined {
  const explicit = (vehicle.primary_image_url ?? vehicle.primaryImageUrl)?.trim();
  if (explicit) return explicit;
  const exterior = vehicle.gallery?.exterior?.find((url) => Boolean(url?.trim()));
  if (exterior) return exterior.trim();
  const legacy = vehicle.images?.find((url) => Boolean(url?.trim()));
  return legacy?.trim();
}

/**
 * Exterior color shown to customers.
 * Known stock-placeholder photos win over a mismatched stored label so the
 * description matches the car in the image. Audited custom listing photos
 * (Pinterest/CDN) use the photo→color map when present, then fall back to DB.
 */
export function resolveExteriorColor(vehicle: {
  slug?: string | null;
  color?: string | null;
  primaryImageUrl?: string | null;
  primary_image_url?: string | null;
  additionalImages?: string[] | null;
  additional_images?: string[] | null;
  gallery?: { exterior?: string[] } | null;
  images?: string[] | null;
}): string {
  const fromStock = colorLabelForImageUrl(primaryImageCandidate(vehicle));
  if (fromStock) return fromStock;

  const slug = vehicle.slug?.trim();
  if (slug) {
    const fromInventoryPhoto = INVENTORY_PHOTO_COLOR_BY_SLUG[slug]?.trim();
    if (fromInventoryPhoto) return fromInventoryPhoto;
  }

  const stored = vehicle.color?.trim();
  return stored ?? "";
}

export function photoIdsMatchingColor(
  photoIds: number[],
  preferredColor: string | null | undefined
): number[] {
  if (!preferredColor?.trim()) return [];
  const preferred = findVehicleColorOption(preferredColor);
  const preferredKey = preferred
    ? normalizeColorKey(preferred.label)
    : normalizeColorKey(preferredColor);
  return photoIds.filter((id) => {
    const label = colorLabelForPhotoId(id);
    if (label == null) return false;
    const resolved = findVehicleColorOption(label);
    const key = resolved ? normalizeColorKey(resolved.label) : normalizeColorKey(label);
    return key === preferredKey;
  });
}

export function countStockPhotoColorMismatches(
  vehicles: Array<{
    color?: string | null;
    images?: string[] | null;
    primaryImageUrl?: string | null;
    primary_image_url?: string | null;
  }>
): { total: number; mismatched: number; matched: number; unknownStock: number } {
  let mismatched = 0;
  let matched = 0;
  let unknownStock = 0;

  for (const vehicle of vehicles) {
    const photoId = pexelsPhotoIdFromUrl(primaryImageCandidate(vehicle));
    if (photoId == null) continue;
    const expected = colorLabelForPhotoId(photoId);
    if (!expected) {
      unknownStock += 1;
      continue;
    }
    const stored = vehicle.color?.trim() ?? "";
    if (!stored) {
      mismatched += 1;
      continue;
    }
    const expectedOpt = findVehicleColorOption(expected);
    const storedOpt = findVehicleColorOption(stored);
    const same =
      expectedOpt && storedOpt
        ? expectedOpt.label === storedOpt.label
        : normalizeColorKey(stored) === normalizeColorKey(expected);
    if (!same) mismatched += 1;
    else matched += 1;
  }

  return {
    total: mismatched + matched + unknownStock,
    mismatched,
    matched,
    unknownStock,
  };
}
