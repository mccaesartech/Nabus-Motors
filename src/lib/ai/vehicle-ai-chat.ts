import {
  BODY_TYPES,
  CONDITIONS,
  FUEL_TYPES,
  LOCATIONS,
  TRANSMISSIONS,
  VEHICLE_STATUSES,
  type VehicleInput,
} from "@/lib/admin/vehicle-fields";
import type { VehicleGalleryData } from "@/lib/types";
import { VEHICLE_GALLERY_ORDER } from "@/lib/types";
import { generateGeminiText, getGeminiApiKey, type GeminiContentPart } from "@/lib/ai/gemini";
import { isPhotoRequest, stockPhotoReply } from "@/lib/ai/photo-request";
import { applyGalleryReplacements } from "@/lib/ai/gallery-commands";
import { suggestStockPhotos } from "@/lib/ai/stock-photo-suggestions";
import type {
  VehicleAiChatChanges,
  VehicleAiChatMessage,
  VehicleAiChatResponse,
  VehicleAiChatVehicleState,
} from "@/lib/ai/vehicle-ai-chat-types";
import {
  collectVisionImageUrls,
  isColorDetectionRequest,
  isDescriptionRewriteRequest,
  isFillFromPhotosRequest,
  isInspectionSummaryRequest,
  isSparseVehicleListing,
  isWarrantyNotesRequest,
  normalizeSuggestedColor,
  reconcileAiColorSuggestion,
  scrubFormColorFromText,
  stockPhotoColorHints,
  vehicleColorPaletteLabels,
} from "@/lib/ai/vehicle-ai-vision";

const ALLOWED_CHANGE_KEYS = new Set([
  "make",
  "model",
  "year",
  "trim",
  "price",
  "mileage",
  "fuel_type",
  "transmission",
  "condition",
  "body_type",
  "location",
  "engine_size",
  "color",
  "vin",
  "description",
  "featured",
  "status",
  "inspection_summary",
  "warranty_notes",
  "drivetrain",
  "horsepower",
  "range",
  "seating_capacity",
  "gallery",
  "removeFromGallery",
  "replaceGallery",
  "appendToDescription",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== "string") return undefined;
  return allowed.includes(value as T) ? (value as T) : undefined;
}

function sanitizeString(value: unknown, maxLen = 5000): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

function sanitizeUrl(value: unknown): string | undefined {
  const str = sanitizeString(value, 2000);
  if (!str) return undefined;
  try {
    const url = new URL(str);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function sanitizeFullGallery(value: unknown): VehicleGalleryData | undefined {
  if (!isRecord(value)) return undefined;
  const gallery: VehicleGalleryData = {
    exterior: [],
    interior: [],
    engine: [],
    other: [],
  };
  for (const key of VEHICLE_GALLERY_ORDER) {
    const raw = value[key];
    if (!Array.isArray(raw)) continue;
    gallery[key] = raw
      .map(sanitizeUrl)
      .filter((u): u is string => Boolean(u))
      .slice(0, 12);
  }
  return gallery;
}

function sanitizeUrlList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const urls = value
    .map(sanitizeUrl)
    .filter((u): u is string => Boolean(u))
    .slice(0, 24);
  return urls.length ? urls : undefined;
}

function sanitizeGallery(value: unknown): Partial<VehicleGalleryData> | undefined {
  if (!isRecord(value)) return undefined;
  const gallery: Partial<VehicleGalleryData> = {};
  for (const key of VEHICLE_GALLERY_ORDER) {
    const raw = value[key];
    if (!Array.isArray(raw)) continue;
    const urls = raw
      .map(sanitizeUrl)
      .filter((u): u is string => Boolean(u))
      .slice(0, 12);
    if (urls.length) gallery[key] = urls;
  }
  return Object.keys(gallery).length ? gallery : undefined;
}

export function sanitizeVehicleAiChanges(
  raw: unknown
): VehicleAiChatChanges | undefined {
  if (!isRecord(raw)) return undefined;

  const changes: VehicleAiChatChanges = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!ALLOWED_CHANGE_KEYS.has(key)) continue;

    if (key === "gallery") {
      const gallery = sanitizeGallery(value);
      if (gallery) changes.gallery = gallery;
      continue;
    }

    if (key === "removeFromGallery") {
      const urls = sanitizeUrlList(value);
      if (urls) changes.removeFromGallery = urls;
      continue;
    }

    if (key === "replaceGallery") {
      const gallery = sanitizeFullGallery(value);
      if (gallery) changes.replaceGallery = gallery;
      continue;
    }

    if (key === "appendToDescription") {
      const text = sanitizeString(value, 4000);
      if (text) changes.appendToDescription = text;
      continue;
    }

    if (key === "year") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 1990 && n <= 2035) changes.year = Math.round(n);
      continue;
    }

    if (key === "price" || key === "mileage") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) changes[key] = Math.round(n);
      continue;
    }

    if (key === "featured") {
      if (typeof value === "boolean") changes.featured = value;
      continue;
    }

    if (key === "fuel_type") {
      const v = pickEnum(value, FUEL_TYPES);
      if (v) changes.fuel_type = v;
      continue;
    }

    if (key === "transmission") {
      const v = pickEnum(value, TRANSMISSIONS);
      if (v) changes.transmission = v;
      continue;
    }

    if (key === "condition") {
      const v = pickEnum(value, CONDITIONS);
      if (v) changes.condition = v;
      continue;
    }

    if (key === "body_type") {
      const v = pickEnum(value, BODY_TYPES);
      if (v) changes.body_type = v;
      continue;
    }

    if (key === "status") {
      const v = pickEnum(value, VEHICLE_STATUSES);
      if (v) changes.status = v;
      continue;
    }

    if (key === "location") {
      const v = pickEnum(value, LOCATIONS);
      if (v) changes.location = v;
      continue;
    }

    if (key === "color") {
      const color = normalizeSuggestedColor(sanitizeString(value, 80));
      if (color) changes.color = color;
      continue;
    }

    if (key === "seating_capacity") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 1 && n <= 60) {
        changes.seating_capacity = Math.round(n);
      }
      continue;
    }

    if (key === "inspection_summary" || key === "warranty_notes") {
      const text = sanitizeString(value, 8000);
      if (text !== undefined) {
        changes[key] = text;
      }
      continue;
    }

    if (key === "drivetrain" || key === "horsepower" || key === "range") {
      const text = sanitizeString(value, 120);
      if (text !== undefined) {
        changes[key] = text;
      }
      continue;
    }

    const text = sanitizeString(value, key === "description" ? 8000 : 200);
    if (text !== undefined) {
      (changes as Record<string, string>)[key] = text;
    }
  }

  return Object.keys(changes).length ? changes : undefined;
}

function emptyish(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return !value.trim();
  if (typeof value === "number") return !Number.isFinite(value) || value === 0;
  return false;
}

export function buildVehicleAiSystemPrompt(
  vehicle: VehicleAiChatVehicleState,
  options?: {
    visionAttached?: boolean;
    visionUrlCount?: number;
    stockColorHints?: Array<{ url: string; color: string }>;
    forceVisionFill?: boolean;
    /** Gallery had photo URLs even if download/vision failed. */
    galleryPhotoCount?: number;
    taskFocus?:
      | "fill"
      | "correct"
      | "description"
      | "inspection"
      | "warranty"
      | "general";
  }
): string {
  const enumHint = `
Allowed enum values (use exactly):
- body_type: ${BODY_TYPES.join(", ")}
- fuel_type: ${FUEL_TYPES.join(", ")}
- transmission: ${TRANSMISSIONS.join(", ")}
- condition: ${CONDITIONS.join(", ")}
- status: ${VEHICLE_STATUSES.join(", ")}
- location: ${LOCATIONS.join(", ")}
- preferred exterior color labels (copy only; paint is vision-detected): ${vehicleColorPaletteLabels().join(", ")}
`;

  const visionAttached = Boolean(options?.visionAttached);
  const galleryPhotoCount = options?.galleryPhotoCount ?? 0;
  const photosPresent = visionAttached || galleryPhotoCount > 0;

  // CRITICAL: never put the staff-entered color label (or that string inside
  // description) in the model context when listing photos exist — models echo it.
  const formColor = vehicle.color?.trim() || "";
  const descriptionForPrompt = photosPresent
    ? scrubFormColorFromText(vehicle.description, formColor) || null
    : vehicle.description || null;
  const inspectionForPrompt = photosPresent
    ? scrubFormColorFromText(vehicle.inspection_summary, formColor) || null
    : vehicle.inspection_summary || null;
  const warrantyForPrompt = photosPresent
    ? scrubFormColorFromText(vehicle.warranty_notes, formColor) || null
    : vehicle.warranty_notes || null;

  const formLabels: Record<string, unknown> = {
    slug: vehicle.slug ?? null,
    make: vehicle.make || null,
    model: vehicle.model || null,
    year: vehicle.year || null,
    trim: vehicle.trim || null,
    price: vehicle.price || null,
    mileage: vehicle.mileage || null,
    fuel_type: vehicle.fuel_type || null,
    transmission: vehicle.transmission || null,
    condition: vehicle.condition || null,
    body_type: vehicle.body_type || null,
    location: vehicle.location || null,
    engine_size: vehicle.engine_size || null,
    vin: vehicle.vin || null,
    drivetrain: vehicle.drivetrain || null,
    horsepower: vehicle.horsepower || null,
    range: vehicle.range || null,
    seating_capacity: vehicle.seating_capacity ?? null,
    description: descriptionForPrompt,
    inspection_summary: inspectionForPrompt,
    warranty_notes: warrantyForPrompt,
    featured: vehicle.featured,
    status: vehicle.status || null,
    gallery: vehicle.gallery,
  };

  if (photosPresent) {
    formLabels.ignore_this_color_label =
      "[REDACTED — exterior color comes from a separate vision-only paint detector; never invent or copy a prior form color]";
  } else {
    formLabels.color = vehicle.color || null;
  }

  const sparse = isSparseVehicleListing(vehicle);
  const forceVisionFill = Boolean(options?.forceVisionFill) || sparse;
  const taskFocus = options?.taskFocus ?? (forceVisionFill ? "fill" : "general");

  const emptyFields: string[] = (
    [
      "make",
      "model",
      "trim",
      "color",
      "engine_size",
      "vin",
      "description",
      "inspection_summary",
      "warranty_notes",
      "drivetrain",
      "horsepower",
      "range",
      "seating_capacity",
    ] as const
  ).filter((key) => emptyish(vehicle[key]));

  // Even when the form already has a color label, force photo re-detection.
  if (photosPresent && !emptyFields.includes("color")) {
    emptyFields.push("color");
  }

  const stockHints =
    options?.stockColorHints?.length ?
      `\nAnnotated Pexels stock-photo color hints (secondary evidence only when the photo is clearly that stock asset — never use these instead of reading real listing photos):\n${JSON.stringify(options.stockColorHints, null, 2)}\n`
    : "";

  const visionRules = visionAttached
    ? `
VISION PROTOCOL (critical — do this before writing changes):
1. Look at all ${options?.visionUrlCount ?? 0} attached listing photo(s). Treat them as ground truth over wrong form labels.
2. Identify: make, model, approximate model year / generation, body_type, trim badges, fuel cues (EV charge port, hybrid badge), transmission cues only if clearly labeled.
3. Read VIN plates / windshield stickers / window stickers ONLY when characters are clearly legible — never invent a VIN.
4. Infer seating_capacity, drivetrain, horsepower, range ONLY when badges/docs/visible cues support them.
5. Draft description / inspection_summary from what you actually see (panel gaps, wear, interior condition, equipment) — never invent accidents or damage not visible.
6. Exterior paint color is decided by a SEPARATE vision-only paint detector that never sees form labels. Omit changes.color (detector fills it).
7. Do not invent price or mileage unless the user explicitly asks or a readable odometer/document is in the photo.
8. When the listing is sparse/blank${sparse ? " (it is)" : ""}, propose a COMPLETE reliable field set (make, model, year, body_type, trim, fuel_type if clear, description). Prefer thorough structured changes over a vague chat reply.
`
    : galleryPhotoCount > 0
      ? `
PHOTOS COULD NOT BE LOADED FOR VISION:
- The listing has ${galleryPhotoCount} gallery photo URL(s), but image bytes were not attached to this request.
- Do NOT invent or repeat any exterior color. Omit changes.color and ask the user to retry or re-upload photos.
- You may still improve text fields from staff notes if they provide them.
`
      : `
NO PHOTOS ATTACHED:
- You cannot see the vehicle. Ask the user to paste/upload exterior photos, or work from VIN/text they provide.
- Do not invent exterior color, make, or model without evidence.
`;

  const taskDirectives: Record<string, string> = {
    fill: `
TASK FOCUS — COMPLETE LISTING FILL:
- Populate / correct the listing as if staff handed you only photos + optional notes.
- Include a confident changes object covering make/model/year/body_type when identifiable.
- Also draft description when identity is clear; add inspection_summary when wear/equipment is visible.
- Color is filled by the vision-only paint detector — omit changes.color.
- In reply: briefly list what you inferred, state overall confidence (high/medium/low), and remind staff to click Apply.
`,
    correct: `
TASK FOCUS — CORRECT WRONG / WEAK FIELDS:
- Compare form labels against photo evidence. Override incorrect make/model/year/body_type/trim/fuel_type.
- Keep correct fields unchanged (omit them from changes).
- Explain each correction briefly in reply with confidence.
`,
    description: `
TASK FOCUS — LISTING COPY:
- Rewrite description to be premium, accurate, and persuasive for Ghana / West Africa buyers.
- Mention known specs only; do not invent options, mileage, price, or accident history.
- Optionally set appendToDescription for feature bullets if the user asked for features.
`,
    inspection: `
TASK FOCUS — INSPECTION SUMMARY:
- Write a professional inspection_summary from visible condition cues + known form facts.
- Structure: exterior, interior, mechanical cues (only if visible), notes for staff.
- Be honest about uncertainty; never invent damage not supported by photos/text.
`,
    warranty: `
TASK FOCUS — WARRANTY NOTES:
- Draft warranty_notes suitable for True Goshen Auto (clear, professional, not legal overclaim).
- Prefer coverage framing staff can edit (e.g. dealer assurance period, what is/isn't covered at a high level).
- Do not invent specific legal terms or durations unless the user provided them — use placeholders like "[confirm months]".
`,
    general: `
TASK FOCUS — GENERAL ASSISTANT:
- Be a senior inventory editor: thorough, structured, decisive with evidence; cautious without it.
- Prefer proposing concrete changes objects over asking many clarifying questions when photos/VIN/text already suffice.
- When unsure, say so in reply and still propose the high-confidence subset.
`,
  };

  return `You are a senior automotive inventory intelligence assistant embedded in True Goshen Auto's platform (premium dealership serving Ghana and West Africa).
You operate at expert dealer-desk quality: multi-step vision reasoning, structured field proposals, and clear confidence — never a shallow echo bot that restates form labels.

Operating principles:
1. Evidence first: photos > readable VIN/docs > staff text > prior form labels (labels may be empty or WRONG).
2. Propose boldly, apply never: staff must click Apply/Approve. Include a rich changes object whenever you can help.
3. Structured over vague: fill concrete fields; use enums exactly; write professional copy for Ghana market (clear English, no slang fluff).
4. Honesty: inventing VIN, mileage, price, accidents, or options is forbidden without evidence.
5. Exterior paint is NEVER copied from form labels when photos exist — a dedicated detector owns color.

Current form labels (may be empty, incomplete, or WRONG — exterior color is redacted when photos exist):
${JSON.stringify(formLabels, null, 2)}

Empty / weak fields to prioritize when filling: ${emptyFields.length ? emptyFields.join(", ") : "(core text fields look filled — still correct mistakes from photos)"}
${stockHints}${enumHint}
${visionRules}${taskDirectives[taskFocus] ?? taskDirectives.general}
Respond ONLY with valid JSON (no markdown fences) in this exact shape:
{
  "reply": "conversational message explaining inferences, corrections, and confidence; remind staff to Apply",
  "changes": { /* optional — only fields to update */ },
  "confidence": "high" | "medium" | "low",
  "fieldNotes": { "make": "badge readable", "year": "gen estimate 2021-2023" },
  "requestStockPhotos": false
}

"changes" may include any of: make, model, year, trim, price, mileage, fuel_type, transmission, condition, body_type, location, engine_size, color, vin, description, featured, status, inspection_summary, warranty_notes, drivetrain, horsepower, range, seating_capacity, gallery, removeFromGallery, replaceGallery, appendToDescription.

Rules:
- "reply" is required: friendly, concise, professional; include overall confidence and what evidence you used.
- Only include fields in "changes" that should actually change (or that you are newly proposing from vision).
- Prefer complete field sets on fill/correct tasks — do not return an empty changes object when photos clearly identify the car.
- Exterior color is applied by a separate vision-only paint detector when photos are attached — prefer omitting changes.color rather than guessing from form labels.
- gallery values are objects with keys exterior, interior, engine, other — each an array of image URLs. Use "gallery" to merge new URLs into categories.
- removeFromGallery: array of image URLs to delete from the gallery (any category).
- replaceGallery: full gallery object when reordering (e.g. move a photo to hero/first exterior position) or clearing a category.
- When the user says "change description to…", "rewrite description", or "make more luxury/premium", set the full description field in changes.
- For feature lists (leather seats, sunroof, etc.) with no dedicated field, use appendToDescription with bullet lines.
- inspection_summary and warranty_notes are first-class fields — write them when asked or when a full fill clearly benefits from them.
- Do not invent VIN, mileage, or price unless the user explicitly asks OR they are clearly readable in an attached photo/document.
- Use enum values exactly as listed above.
- Set requestStockPhotos to true ONLY when the user asks for stock/placeholder photo suggestions from Pexels.
- You cannot upload files. Color filters and photo quality enhance / upscale / 4K requests are handled by a separate image pipeline with before/after Approve — never claim you cannot enhance or upscale photos. You can remove/reorder gallery URLs.
- Multi-turn: respect chat history. Photos attached to this turn are ground truth for appearance.
- Staff must click Apply before form fields change — propose changes boldly; do not refuse to suggest because labels already exist.`;
}

function parseModelJson(raw: string): VehicleAiChatResponse {
  const jsonText = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    return { reply: raw.trim() || "I couldn't parse a structured response. Please try again." };
  }

  let reply =
    sanitizeString(parsed.reply, 8000) ??
    "Done. Review the suggested changes below and apply if they look right.";

  const confidenceRaw = typeof parsed.confidence === "string" ? parsed.confidence.toLowerCase() : "";
  const confidence =
    confidenceRaw === "high" || confidenceRaw === "medium" || confidenceRaw === "low"
      ? (confidenceRaw as "high" | "medium" | "low")
      : undefined;

  if (confidence && !/\bconfidence\b/i.test(reply)) {
    reply = `${reply.trim()}\n\nConfidence: ${confidence}.`;
  }

  if (isRecord(parsed.fieldNotes)) {
    const notes = Object.entries(parsed.fieldNotes)
      .map(([k, v]) => (typeof v === "string" && v.trim() ? `${k}: ${v.trim()}` : null))
      .filter((n): n is string => Boolean(n))
      .slice(0, 12);
    if (notes.length && !/\bfield notes\b/i.test(reply)) {
      reply = `${reply.trim()}\n\nField notes:\n• ${notes.join("\n• ")}`;
    }
  }

  const changes = sanitizeVehicleAiChanges(parsed.changes);
  const requestStockPhotos = parsed.requestStockPhotos === true;

  return {
    reply,
    changes,
    ...(confidence ? { confidence } : {}),
    ...(requestStockPhotos ? { requestStockPhotos: true } : {}),
  };
}

export function resolveVehicleAiTaskFocus(
  lastUserContent: string | undefined,
  forceVisionFill: boolean
): "fill" | "correct" | "description" | "inspection" | "warranty" | "general" {
  if (!lastUserContent) return forceVisionFill ? "fill" : "general";
  if (isWarrantyNotesRequest(lastUserContent) && !isFillFromPhotosRequest(lastUserContent)) {
    return "warranty";
  }
  if (isInspectionSummaryRequest(lastUserContent)) {
    return "inspection";
  }
  if (isDescriptionRewriteRequest(lastUserContent)) {
    return "description";
  }
  if (/\bcorrect\b|\bfix\b.*\b(wrong|incorrect)\b/i.test(lastUserContent)) {
    return "correct";
  }
  if (forceVisionFill || isFillFromPhotosRequest(lastUserContent)) {
    return "fill";
  }
  return "general";
}

type ParsedWithFlag = VehicleAiChatResponse & { requestStockPhotos?: boolean };

export type VehicleAiVisionImage = {
  url: string;
  data: string;
  mimeType: string;
};

/**
 * Dedicated exterior paint detector: images + palette only.
 * Never receives form color, description, make/model, URLs, or chat history.
 */
export function buildVisionOnlyColorPrompt(): string {
  const palette = vehicleColorPaletteLabels().join(", ");
  return `You are an expert vehicle exterior paint-color detector with dealership-grade accuracy.
Look ONLY at the attached photo bytes. Return ONLY valid JSON (no markdown):
{"color":"<label or null>","confidence":"high"|"medium"|"low"|"none","reason":"short visual cue"}

Rules:
- Identify the dominant exterior body paint color of the vehicle in the photos.
- Prefer one of these labels when it reasonably fits: ${palette}
- Custom factory names are OK only when none of the preferred labels fit.
- If exterior paint is not visible, return {"color":null,"confidence":"none","reason":"no exterior paint visible"}.
- Do NOT use inventory labels, form data, filenames, URLs, or prior chat — only visible paint.
- Ignore reflections, sky, background, wheels, brake calipers, and interior trim.
- Prefer high confidence only when multiple angles or clear daylight body panels agree.`;
}

export function parseVisionOnlyColorResponse(raw: string): string | null {
  const jsonText = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    const parsed = JSON.parse(jsonText) as { color?: unknown; confidence?: unknown };
    if (parsed.confidence === "none") return null;
    if (typeof parsed.color !== "string" || !parsed.color.trim()) return null;
    return normalizeSuggestedColor(parsed.color) ?? null;
  } catch {
    // Accept a short bare color token only (palette / synonym), never prose.
    const line = raw.trim().split("\n")[0]?.trim().replace(/^["']|["']$/g, "") ?? "";
    if (!line || line.length > 40 || line.split(/\s+/).length > 3) return null;
    const normalized = normalizeSuggestedColor(line);
    if (!normalized) return null;
    // If normalization didn't map to a known synonym/palette label and looks like prose, reject.
    if (normalized === line && /[^a-zA-Z\s-]/.test(line)) return null;
    if (/\b(json|color|paint|vehicle|car|the|this|looks)\b/i.test(line)) return null;
    return normalized;
  }
}

/** Vision-only paint detection — zero form / inventory color context. */
export async function detectExteriorPaintColorFromVision(
  visionImages: VehicleAiVisionImage[]
): Promise<string | null> {
  if (!visionImages.length) return null;

  const parts: GeminiContentPart[] = [{ text: buildVisionOnlyColorPrompt() }];
  for (const img of visionImages) {
    // Intentionally omit URLs — stock CDN paths / filenames must not bias color.
    parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
  }

  const raw = await generateGeminiText(parts, {
    inventoryModel: true,
    jsonMode: true,
    temperature: 0.2,
    maxRetries: 2,
  });
  return parseVisionOnlyColorResponse(raw);
}

/** Free Pexels stock photos — no Gemini API key or quota required. */
export function generateStockPhotoSuggestions(
  vehicle: VehicleAiChatVehicleState
): VehicleAiChatResponse {
  const photos = suggestStockPhotos(vehicle);
  return {
    reply: stockPhotoReply(vehicle),
    suggestedImages: photos,
    photoSource: "pexels",
    geminiSkipped: true,
  };
}

function colorUnavailableReply(hasGalleryPhotos: boolean): VehicleAiChatResponse {
  return {
    reply: hasGalleryPhotos
      ? "I couldn't read the exterior paint color from the listing photos in this request. I'm not using the color already on the form — please retry or re-upload clearer exterior photos."
      : "Upload or paste exterior photos first, then ask me to detect the paint color from those images.",
  };
}

export async function generateVehicleAiChatReply(
  messages: VehicleAiChatMessage[],
  vehicle: VehicleAiChatVehicleState,
  options?: { visionImages?: VehicleAiVisionImage[] }
): Promise<VehicleAiChatResponse> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (lastUser && isPhotoRequest(lastUser.content) && !isFillFromPhotosRequest(lastUser.content)) {
    if (!vehicle.make?.trim() || !vehicle.model?.trim()) {
      return {
        reply:
          "Enter make and model on the form first — then I can suggest relevant stock photos from Pexels (free, no AI quota needed). Or paste real photos and ask me to fill the listing from them.",
        geminiSkipped: true,
      };
    }
    return generateStockPhotoSuggestions(vehicle);
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_NOT_CONFIGURED");
  }

  const visionImages = options?.visionImages ?? [];
  const visionUrls = visionImages.map((img) => img.url);
  const galleryCandidateUrls = collectVisionImageUrls(vehicle.gallery, vehicle.images);
  const candidateUrls =
    visionUrls.length > 0 ? visionUrls : galleryCandidateUrls;
  // Only attach Pexels stock hints when we could not attach real vision bytes —
  // otherwise annotated URL→color maps can override what the photos actually show.
  const hints =
    visionImages.length > 0 ? [] : stockPhotoColorHints(candidateUrls);
  const forceVisionFill =
    Boolean(lastUser && isFillFromPhotosRequest(lastUser.content)) ||
    isSparseVehicleListing(vehicle);
  const taskFocus = resolveVehicleAiTaskFocus(lastUser?.content, forceVisionFill);

  // Color-only asks skip the form-aware chat entirely (paint detector only).
  // Require a short/color-focused message — never steal full listing-fill turns.
  const wantsColorOnly = Boolean(
    lastUser &&
      isColorDetectionRequest(lastUser.content) &&
      !/\bfill\b/i.test(lastUser.content) &&
      !/\bpopulate\b/i.test(lastUser.content) &&
      !/\b(make|model|year|trim|description|body[_\s-]?type|inspection|warranty)\b/i.test(
        lastUser.content
      )
  );

  if (lastUser && wantsColorOnly) {
    if (visionImages.length === 0) {
      return colorUnavailableReply(galleryCandidateUrls.length > 0);
    }
    try {
      const visionColor = await detectExteriorPaintColorFromVision(visionImages);
      if (!visionColor) {
        return colorUnavailableReply(true);
      }
      return {
        reply: `From the listing photos, the exterior paint looks like ${visionColor}. Apply to update the color field.`,
        changes: { color: visionColor },
        confidence: "high",
      };
    } catch {
      return colorUnavailableReply(true);
    }
  }

  const historyText = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const parts: GeminiContentPart[] = [
    {
      text: buildVehicleAiSystemPrompt(vehicle, {
        visionAttached: visionImages.length > 0,
        visionUrlCount: visionImages.length,
        stockColorHints: hints,
        forceVisionFill,
        galleryPhotoCount: galleryCandidateUrls.length,
        taskFocus,
      }),
    },
    { text: `Conversation so far:\n${historyText || "(new conversation)"}` },
  ];

  if (visionImages.length > 0) {
    parts.push({
      text: "Attached listing photos for visual analysis (identity / trim / body / condition cues). Exterior color is decided by a separate vision-only paint detector — do not invent color from form labels. Analyze thoroughly before proposing changes.",
    });
    for (const img of visionImages) {
      parts.push({ text: `\nPhoto URL: ${img.url}` });
      parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
    }
  }

  const geminiOpts = {
    inventoryModel: true as const,
    jsonMode: true as const,
    temperature: visionImages.length > 0 ? 0.25 : 0.35,
  };

  // Run listing chat + dedicated paint detector in parallel when photos are attached.
  let rawText: string;
  let visionDetectedColor: string | null = null;
  if (visionImages.length > 0) {
    const [chatRaw, paintColor] = await Promise.all([
      generateGeminiText(parts, geminiOpts),
      detectExteriorPaintColorFromVision(visionImages).catch(() => null),
    ]);
    rawText = chatRaw;
    visionDetectedColor = paintColor;
  } else {
    rawText = await generateGeminiText(parts, geminiOpts);
  }

  const parsed = parseModelJson(rawText) as ParsedWithFlag;
  const guarded = applyVisionColorGuard(parsed, {
    formColor: vehicle.color,
    visionAttached: visionImages.length > 0,
    galleryPhotoCount: galleryCandidateUrls.length,
    visionDetectedColor,
  });

  let suggestedImages: VehicleGalleryData | undefined;
  if (guarded.requestStockPhotos && vehicle.make?.trim() && vehicle.model?.trim()) {
    suggestedImages = suggestStockPhotos(vehicle);
  }

  return {
    reply: guarded.reply,
    changes: guarded.changes,
    suggestedImages,
    ...(guarded.confidence ? { confidence: guarded.confidence } : {}),
  };
}

/**
 * Prefer dedicated vision paint detection; refuse form-label echoes when photos
 * exist but vision bytes / detection were unavailable.
 */
export function applyVisionColorGuard(
  response: VehicleAiChatResponse & { requestStockPhotos?: boolean },
  options: {
    formColor: string | null | undefined;
    visionAttached: boolean;
    galleryPhotoCount: number;
    visionDetectedColor?: string | null;
  }
): VehicleAiChatResponse & { requestStockPhotos?: boolean } {
  const reconciled = reconcileAiColorSuggestion({
    formColor: options.formColor,
    suggestedColor: response.changes?.color,
    visionAttached: options.visionAttached,
    galleryPhotoCount: options.galleryPhotoCount,
    visionDetectedColor: options.visionDetectedColor,
  });

  let changes = response.changes ? { ...response.changes } : undefined;
  let reply = response.reply;

  if (reconciled.color) {
    changes = { ...(changes ?? {}), color: reconciled.color };
  } else if (changes && "color" in changes) {
    delete changes.color;
    if (Object.keys(changes).length === 0) changes = undefined;
  }

  if (reconciled.visionUnavailable) {
    const note =
      "I couldn't read the exterior paint from the listing photos in this request, so I'm not suggesting a color from the form label. Re-upload or retry so I can detect paint from the images.";
    if (
      !reply.toLowerCase().includes("couldn't read the exterior paint") &&
      !reply.toLowerCase().includes("couldn't analyze") &&
      !reply.toLowerCase().includes("could not")
    ) {
      reply = `${reply.trim()}\n\n${note}`;
    }
  } else if (
    reconciled.color &&
    options.visionDetectedColor &&
    !reply.toLowerCase().includes(reconciled.color.toLowerCase())
  ) {
    reply = `${reply.trim()}\n\nExterior paint from photos: ${reconciled.color}.`;
  }

  return {
    ...response,
    reply,
    changes,
  };
}

export function mergeGallery(
  current: VehicleGalleryData,
  patch: Partial<VehicleGalleryData>
): VehicleGalleryData {
  const next = { ...current };
  for (const key of VEHICLE_GALLERY_ORDER) {
    const urls = patch[key];
    if (!urls?.length) continue;
    const existing = next[key];
    const merged = [...existing];
    for (const url of urls) {
      if (!merged.includes(url)) merged.push(url);
    }
    next[key] = merged;
  }
  return next;
}

export function applyVehicleAiChanges(
  form: VehicleInput,
  gallery: VehicleGalleryData,
  changes: VehicleAiChatChanges
): { form: VehicleInput; gallery: VehicleGalleryData } {
  let nextForm = { ...form };
  let nextGallery = { ...gallery };

  const {
    gallery: galleryPatch,
    removeFromGallery,
    replaceGallery,
    appendToDescription,
    ...fieldPatch
  } = changes;

  if (appendToDescription) {
    const base = nextForm.description?.trim() ?? "";
    const separator = base ? "\n\n" : "";
    nextForm.description = `${base}${separator}${appendToDescription.trim()}`;
  }

  nextForm = { ...nextForm, ...fieldPatch };

  if (removeFromGallery || replaceGallery) {
    nextGallery = applyGalleryReplacements(nextGallery, {
      removeFromGallery,
      replaceGallery,
    });
  }

  if (galleryPatch) {
    nextGallery = mergeGallery(nextGallery, galleryPatch);
  }

  return { form: nextForm, gallery: nextGallery };
}
