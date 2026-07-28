import type { VehicleGalleryData } from "@/lib/types";
import { VEHICLE_GALLERY_ORDER } from "@/lib/types";
import {
  colorLabelForImageUrl,
  findVehicleColorOption,
  normalizeColorKey,
  VEHICLE_COLOR_OPTIONS,
} from "@/lib/vehicles/vehicle-colors";

/** More photos → better make/model/year/trim/VIN plate coverage. */
export const MAX_VEHICLE_AI_VISION_IMAGES = 8;

/** Detect requests that only need exterior paint from photos (not full listing fill). */
export function isColorDetectionRequest(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  const patterns = [
    /^detect\s+exterior\s+color\s+from\s+photos$/i,
    /\bdetect\b.*\b(exterior\s+)?(paint\s+)?color\b/i,
    /\b(what|which)\s+(color|paint)\b/i,
    /\b(exterior\s+)?(paint\s+)?color\b.*\b(from|in|using)\b.*\b(photo|photos|image|images)\b/i,
    /\bread\b.*\b(paint|color)\b/i,
  ];
  return patterns.some((p) => p.test(text));
}

/** Detect requests to infer listing fields from uploaded photos / blank-form fill. */
export function isFillFromPhotosRequest(message: string): boolean {
  const text = message.trim();
  if (!text) return false;

  // Color-only asks still count as photo-fill intents (not stock photos).
  if (isColorDetectionRequest(text)) return true;

  const patterns = [
    /\bfill\b.*\b(from|using|via)\b.*\b(photo|photos|image|images|picture|pictures)\b/i,
    /\b(analyze|inspect|read|scan|detect|identify|infer)\b.*\b(photo|photos|image|images|picture|pictures)\b/i,
    /\b(photo|photos|image|images)\b.*\b(fill|detect|identify|infer|analyze|read)\b/i,
    /\bfill\b.*\b(listing|form|fields|details|specs)\b/i,
    /\b(blank|empty)\b.*\b(listing|form)\b/i,
    /\bwhat\s+(make|model|year|car|vehicle)\b/i,
    /\bread\b.*\b(the\s+)?(car|vehicle|listing)\b/i,
    /\bpopulate\b.*\b(fields|listing|form)\b/i,
    /\bcorrect\b.*\b(fields?|listing|form|details)\b/i,
    /\bfix\b.*\b(wrong|incorrect|mistaken)\b.*\b(fields?|listing|details)\b/i,
  ];

  return patterns.some((p) => p.test(text));
}

/** Staff wants inspection_summary drafted from photos / known specs. */
export function isInspectionSummaryRequest(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return (
    /\binspection\b/i.test(text) ||
    /\bcondition\s+report\b/i.test(text) ||
    /\bwalk[- ]?around\s+(notes|summary)\b/i.test(text) ||
    /\bvisual\s+(inspection|condition)\b/i.test(text)
  );
}

/** Staff wants warranty_notes drafted. */
export function isWarrantyNotesRequest(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return (
    /\bwarranty\b/i.test(text) ||
    /\bguarantee\b/i.test(text) ||
    /\bafter[- ]?sales?\b.*\b(cover|coverages?|notes?)\b/i.test(text)
  );
}

/** Staff wants a premium description rewrite (not full vision fill). */
export function isDescriptionRewriteRequest(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  if (isFillFromPhotosRequest(text) && !/\bdescription\b/i.test(text)) return false;
  return (
    /\b(rewrite|improve|polish|upgrade|edit)\b.*\bdescription\b/i.test(text) ||
    /\bdescription\b.*\b(rewrite|improve|polish|premium|luxury|compelling)\b/i.test(text) ||
    /^edit\s+description$/i.test(text) ||
    /^improve\s+the\s+listing\s+description$/i.test(text) ||
    /\bmake\s+(the\s+)?(title|listing|description)\s+sound\s+more\s+premium\b/i.test(text)
  );
}

/**
 * Remove the staff-entered color label from free text so it cannot leak into
 * a vision prompt via description / notes.
 */
export function scrubFormColorFromText(
  text: string | null | undefined,
  formColor: string | null | undefined
): string {
  const source = text ?? "";
  const color = formColor?.trim();
  if (!source || !color) return source;

  const candidates = new Set<string>([color]);
  const normalized = normalizeSuggestedColor(color);
  if (normalized) candidates.add(normalized);
  const known = findVehicleColorOption(color);
  if (known) candidates.add(known.label);

  // Longer labels first so "Charcoal Gray" is scrubbed before "Gray".
  const labels = [...candidates].sort((a, b) => b.length - a.length);
  let out = source;
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "[COLOR REDACTED]");
  }
  return out;
}

/**
 * Prefer exterior shots, then other categories, for Gemini vision.
 * Dedupes URLs and caps count.
 */
export function collectVisionImageUrls(
  gallery: VehicleGalleryData,
  legacyImages?: string[] | null,
  maxImages: number = MAX_VEHICLE_AI_VISION_IMAGES
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (url: string | null | undefined) => {
    const trimmed = url?.trim();
    if (!trimmed || seen.has(trimmed) || out.length >= maxImages) return;
    seen.add(trimmed);
    out.push(trimmed);
  };

  for (const url of gallery.exterior ?? []) push(url);
  for (const url of legacyImages ?? []) push(url);
  for (const key of VEHICLE_GALLERY_ORDER) {
    if (key === "exterior") continue;
    for (const url of gallery[key] ?? []) push(url);
  }

  return out;
}

/** Map stock Pexels URLs to annotated exterior colors (hint only). */
export function stockPhotoColorHints(urls: string[]): Array<{ url: string; color: string }> {
  const hints: Array<{ url: string; color: string }> = [];
  for (const url of urls) {
    const color = colorLabelForImageUrl(url);
    if (color) hints.push({ url, color });
  }
  return hints;
}

/** Prefer a canonical palette label when the model returns a close match. */
export function normalizeSuggestedColor(value: string | null | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim().slice(0, 80);
  const known = findVehicleColorOption(trimmed);
  if (known) return known.label;

  // Soft synonyms → palette
  const key = trimmed.toLowerCase().replace(/[\s_-]+/g, " ");
  const synonyms: Record<string, string> = {
    grey: "Gray",
    "dark grey": "Charcoal",
    "dark gray": "Charcoal",
    "light grey": "Silver",
    "light gray": "Silver",
    "dark blue": "Navy",
    "light blue": "Sky Blue",
    "dark red": "Crimson",
    "dark green": "Forest Green",
    white: "White",
    black: "Black",
    silver: "Silver",
    blue: "Blue",
    red: "Red",
    green: "Green",
    yellow: "Yellow",
    orange: "Orange",
    brown: "Brown",
    gold: "Gold",
    beige: "Beige",
    cream: "Cream",
    navy: "Navy",
    maroon: "Maroon",
    burgundy: "Burgundy",
    purple: "Purple",
    teal: "Teal",
    pink: "Pink",
    coral: "Coral",
  };
  const mapped = synonyms[key];
  if (mapped) return mapped;

  return trimmed;
}

export function exteriorColorsMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const left = a?.trim();
  const right = b?.trim();
  if (!left || !right) return false;
  const na = normalizeSuggestedColor(left) ?? left;
  const nb = normalizeSuggestedColor(right) ?? right;
  return normalizeColorKey(na) === normalizeColorKey(nb);
}

/**
 * When listing photos exist, never trust / echo the form's color label.
 * - Dedicated visionDetectedColor is the only trusted source when photos were analyzed.
 * - Photos exist but vision failed / detection empty: refuse form echo and chat guesses.
 * - No photos: allow free-text color suggestions.
 */
export function reconcileAiColorSuggestion(options: {
  formColor: string | null | undefined;
  suggestedColor: string | null | undefined;
  visionAttached: boolean;
  galleryPhotoCount: number;
  /** Result of the vision-only paint detector (no form context). */
  visionDetectedColor?: string | null;
}): {
  color?: string;
  refusedFormEcho: boolean;
  visionUnavailable: boolean;
} {
  const suggested = options.suggestedColor
    ? normalizeSuggestedColor(options.suggestedColor)
    : undefined;
  const visionColor = options.visionDetectedColor
    ? normalizeSuggestedColor(options.visionDetectedColor)
    : undefined;

  if (options.visionAttached) {
    if (visionColor) {
      return {
        color: visionColor,
        refusedFormEcho: Boolean(
          suggested && exteriorColorsMatch(suggested, options.formColor)
        ),
        visionUnavailable: false,
      };
    }
    // Bytes were attached but dedicated detection failed — never fall back to form/chat.
    return {
      refusedFormEcho: Boolean(
        suggested && exteriorColorsMatch(suggested, options.formColor)
      ),
      visionUnavailable: true,
    };
  }

  if (options.galleryPhotoCount > 0) {
    // Photos were present but not analyzed — do not echo the labeled form color.
    if (suggested && exteriorColorsMatch(suggested, options.formColor)) {
      return { refusedFormEcho: true, visionUnavailable: true };
    }
    // Without vision, any color guess is unreliable; prefer refusing over inventing.
    return {
      refusedFormEcho: Boolean(suggested),
      visionUnavailable: true,
    };
  }

  return {
    ...(suggested ? { color: suggested } : {}),
    refusedFormEcho: false,
    visionUnavailable: false,
  };
}

export function vehicleColorPaletteLabels(): string[] {
  return VEHICLE_COLOR_OPTIONS.map((o) => o.label);
}

/** True when core identity fields look blank / default — vision fill is especially useful. */
export function isSparseVehicleListing(vehicle: {
  make?: string | null;
  model?: string | null;
  color?: string | null;
  description?: string | null;
  trim?: string | null;
  vin?: string | null;
  mileage?: number | null;
  price?: number | null;
  inspection_summary?: string | null;
  warranty_notes?: string | null;
}): boolean {
  const make = vehicle.make?.trim() ?? "";
  const model = vehicle.model?.trim() ?? "";
  const color = vehicle.color?.trim() ?? "";
  const description = vehicle.description?.trim() ?? "";
  const filledIdentity = [make, model, color].filter(Boolean).length;
  const hasCopy = description.length > 40;
  const hasCommercial =
    (Number(vehicle.mileage) || 0) > 0 || (Number(vehicle.price) || 0) > 0;
  return filledIdentity <= 1 && !hasCopy && !hasCommercial;
}

export type VehicleAiQuickAction =
  | "Fill listing from photos"
  | "Detect exterior color from photos"
  | "Correct fields from photos"
  | "Write inspection summary"
  | "Draft warranty notes"
  | "Improve the listing description"
  | "Make the title sound more premium"
  | "Edit description"
  | "Find stock photos (free)"
  | "Enhance photos (4K)"
  | "Warm up colors"
  | "Increase contrast";

/**
 * Context-aware quick actions: empty listings with photos get vision-first chips;
 * filled listings get copy / inspection / warranty helpers first.
 */
export function selectVehicleAiQuickActions(options: {
  sparse: boolean;
  hasGalleryPhotos: boolean;
  hasDescription: boolean;
  hasInspection: boolean;
  hasWarranty: boolean;
}): VehicleAiQuickAction[] {
  const {
    sparse,
    hasGalleryPhotos,
    hasDescription,
    hasInspection,
    hasWarranty,
  } = options;

  const actions: VehicleAiQuickAction[] = [];

  if (hasGalleryPhotos) {
    if (sparse) {
      actions.push("Fill listing from photos", "Detect exterior color from photos");
    } else {
      actions.push(
        "Correct fields from photos",
        "Detect exterior color from photos",
        "Fill listing from photos"
      );
    }
  } else {
    actions.push("Fill listing from photos", "Find stock photos (free)");
  }

  if (!hasDescription) {
    actions.push("Improve the listing description");
  } else {
    actions.push("Edit description", "Make the title sound more premium");
  }

  if (!hasInspection) {
    actions.push("Write inspection summary");
  }
  if (!hasWarranty) {
    actions.push("Draft warranty notes");
  }

  if (hasGalleryPhotos) {
    actions.push("Enhance photos (4K)");
  }
  actions.push("Warm up colors", "Increase contrast");

  if (hasGalleryPhotos && !actions.includes("Find stock photos (free)")) {
    actions.push("Find stock photos (free)");
  }

  // Deduplicate while preserving order.
  const seen = new Set<string>();
  return actions.filter((a) => {
    if (seen.has(a)) return false;
    seen.add(a);
    return true;
  });
}

/** Count how many gallery slots have at least one URL. */
export function countGalleryPhotos(gallery: VehicleGalleryData | null | undefined): number {
  if (!gallery) return 0;
  let n = 0;
  for (const key of VEHICLE_GALLERY_ORDER) {
    n += gallery[key]?.length ?? 0;
  }
  return n;
}
