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
import { generateGeminiText, getGeminiApiKey } from "@/lib/ai/gemini";
import { isPhotoRequest, stockPhotoReply } from "@/lib/ai/photo-request";
import { applyGalleryReplacements } from "@/lib/ai/gallery-commands";
import { suggestStockPhotos } from "@/lib/ai/stock-photo-suggestions";
import type {
  VehicleAiChatChanges,
  VehicleAiChatMessage,
  VehicleAiChatResponse,
  VehicleAiChatVehicleState,
} from "@/lib/ai/vehicle-ai-chat-types";

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

    const text = sanitizeString(value, key === "description" ? 8000 : 200);
    if (text !== undefined) {
      (changes as Record<string, string>)[key] = text;
    }
  }

  return Object.keys(changes).length ? changes : undefined;
}

function buildSystemPrompt(vehicle: VehicleAiChatVehicleState): string {
  const enumHint = `
Allowed values:
- body_type: ${BODY_TYPES.join(", ")}
- fuel_type: ${FUEL_TYPES.join(", ")}
- transmission: ${TRANSMISSIONS.join(", ")}
- condition: ${CONDITIONS.join(", ")}
- status: ${VEHICLE_STATUSES.join(", ")}
- location: ${LOCATIONS.join(", ")}
`;

  return `You are an expert automotive listing assistant embedded in the True Goshen Auto admin panel (premium dealership in Ghana and West Africa).
You help staff edit vehicle listings through natural conversation — like ChatGPT inside the website.

Current listing state (JSON):
${JSON.stringify(
  {
    slug: vehicle.slug,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    trim: vehicle.trim,
    price: vehicle.price,
    mileage: vehicle.mileage,
    fuel_type: vehicle.fuel_type,
    transmission: vehicle.transmission,
    condition: vehicle.condition,
    body_type: vehicle.body_type,
    location: vehicle.location,
    engine_size: vehicle.engine_size,
    color: vehicle.color,
    vin: vehicle.vin,
    description: vehicle.description,
    featured: vehicle.featured,
    status: vehicle.status,
    gallery: vehicle.gallery,
  },
  null,
  2
)}
${enumHint}

Respond ONLY with valid JSON (no markdown fences) in this exact shape:
{
  "reply": "conversational message to the user explaining what you did or asking clarifying questions",
  "changes": { /* optional — only fields to update */ },
  "requestStockPhotos": false
}

"changes" may include any of: make, model, year, trim, price, mileage, fuel_type, transmission, condition, body_type, location, engine_size, color, vin, description, featured, status, gallery, removeFromGallery, replaceGallery, appendToDescription.

Rules:
- "reply" is required and should be friendly, concise, and professional.
- Only include fields in "changes" that should actually change.
- gallery values are objects with keys exterior, interior, engine, other — each an array of image URLs. Use "gallery" to merge new URLs into categories.
- removeFromGallery: array of image URLs to delete from the gallery (any category).
- replaceGallery: full gallery object when reordering (e.g. move a photo to hero/first exterior position) or clearing a category.
- When the user says "change description to…", "rewrite description", or "make more luxury/premium", set the full description field in changes.
- For feature lists (leather seats, sunroof, etc.) with no dedicated field, use appendToDescription with bullet lines to append to the description.
- Do not invent VIN, mileage, or price unless the user explicitly asks to set them.
- Use enum values exactly as listed above.
- Set requestStockPhotos to true ONLY when the user asks for stock/placeholder photo suggestions from Pexels.
- You cannot upload files or apply color filters; color adjustments are handled separately. You can remove/reorder gallery URLs.
- Multi-turn: respect chat history and the current form state.`;
}

function parseModelJson(raw: string): VehicleAiChatResponse {
  const jsonText = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    return { reply: raw.trim() || "I couldn't parse a structured response. Please try again." };
  }

  const reply =
    sanitizeString(parsed.reply, 8000) ??
    "Done. Review the suggested changes below and apply if they look right.";

  const changes = sanitizeVehicleAiChanges(parsed.changes);
  const requestStockPhotos = parsed.requestStockPhotos === true;

  return { reply, changes, ...(requestStockPhotos ? { requestStockPhotos: true } : {}) };
}

type ParsedWithFlag = VehicleAiChatResponse & { requestStockPhotos?: boolean };

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

export async function generateVehicleAiChatReply(
  messages: VehicleAiChatMessage[],
  vehicle: VehicleAiChatVehicleState
): Promise<VehicleAiChatResponse> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (lastUser && isPhotoRequest(lastUser.content)) {
    if (!vehicle.make?.trim() || !vehicle.model?.trim()) {
      return {
        reply:
          "Enter make and model on the form first — then I can suggest relevant stock photos from Pexels (free, no AI quota needed).",
        geminiSkipped: true,
      };
    }
    return generateStockPhotoSuggestions(vehicle);
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_NOT_CONFIGURED");
  }

  const historyText = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const rawText = await generateGeminiText([
    { text: buildSystemPrompt(vehicle) },
    { text: `Conversation so far:\n${historyText || "(new conversation)"}` },
  ]);

  const parsed = parseModelJson(rawText) as ParsedWithFlag;

  let suggestedImages: VehicleGalleryData | undefined;
  if (parsed.requestStockPhotos && vehicle.make?.trim() && vehicle.model?.trim()) {
    suggestedImages = suggestStockPhotos(vehicle);
  }

  return {
    reply: parsed.reply,
    changes: parsed.changes,
    suggestedImages,
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
