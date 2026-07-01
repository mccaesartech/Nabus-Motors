import { GoogleGenerativeAI } from "@google/generative-ai";
import type { VehicleInput } from "@/lib/admin/vehicle-fields";
import type { VehicleAiAction, VehicleAiSuggestions } from "@/lib/ai/vehicle-ai-types";

/** Default model — widely available on AI Studio free and paid tiers. */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/** Fallback order when the primary model is unavailable or has zero free-tier quota. */
export const GEMINI_MODEL_FALLBACKS = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
] as const;

/** Models removed or blocked on AI Studio free tier — never use even if GEMINI_MODEL is set. */
const DEPRECATED_GEMINI_MODELS = new Set([
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-exp",
  "gemini-2.0-pro",
  "gemini-2.0-pro-exp",
]);

export type GeminiErrorCode =
  | "QUOTA_EXCEEDED"
  | "INVALID_KEY"
  | "MODEL_NOT_FOUND"
  | "UNKNOWN";

export class GeminiApiError extends Error {
  readonly code: GeminiErrorCode;

  constructor(message: string, code: GeminiErrorCode) {
    super(message);
    this.name = "GeminiApiError";
    this.code = code;
  }
}

export function getGeminiApiKey(): string | null {
  const key =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!key || key.includes("your_") || key.length < 10) return null;
  return key;
}

function normalizeGeminiModel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed || DEPRECATED_GEMINI_MODELS.has(trimmed)) {
    return DEFAULT_GEMINI_MODEL;
  }
  return trimmed;
}

/** Ordered model candidates: configured (or default) first, then fallbacks. */
export function getGeminiModelCandidates(): string[] {
  const configured = process.env.GEMINI_MODEL?.trim();
  const primary = normalizeGeminiModel(configured || DEFAULT_GEMINI_MODEL);
  const candidates: string[] = [primary];
  for (const fallback of GEMINI_MODEL_FALLBACKS) {
    if (!candidates.includes(fallback)) {
      candidates.push(fallback);
    }
  }
  return candidates;
}

export function getGeminiModel(): string {
  return getGeminiModelCandidates()[0];
}

/**
 * Google AI Studio keys: legacy standard (AIzaSy…) or new auth keys (AQ.…).
 * Both work with @google/generative-ai on the native Gemini API (free tier included).
 * Vertex / service-account JSON keys need a different SDK.
 */
export function getGeminiKeyFormat():
  | "ai_studio_auth"
  | "ai_studio_legacy"
  | "unknown"
  | "missing" {
  const key = getGeminiApiKey();
  if (!key) return "missing";
  if (key.startsWith("AQ.")) return "ai_studio_auth";
  if (key.startsWith("AIzaSy")) return "ai_studio_legacy";
  if (key.startsWith("AIza")) return "ai_studio_legacy";
  return "unknown";
}

export function isAiStudioGeminiKey(key: string): boolean {
  return key.startsWith("AQ.") || key.startsWith("AIza");
}

export function getGeminiKeyWarning(): string | null {
  const format = getGeminiKeyFormat();
  if (format === "unknown") {
    return (
      "Your GEMINI_API_KEY does not look like a Google AI Studio key (expected AQ. or AIzaSy prefix). " +
      "Create a free key at aistudio.google.com/apikey — new keys start with AQ. Vertex AI keys need a different setup."
    );
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(message: string): number | null {
  const match = message.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  if (!match) return null;
  return Math.ceil(parseFloat(match[1]) * 1000);
}

function shouldFallbackToNextModel(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (
    lower.includes("404") ||
    (lower.includes("not found") && lower.includes("model")) ||
    lower.includes("is not supported")
  ) {
    return true;
  }

  if (
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("resource exhausted") ||
    lower.includes("limit: 0")
  ) {
    return true;
  }

  return false;
}

function classifyGeminiError(err: unknown): GeminiApiError {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("resource exhausted")
  ) {
    return new GeminiApiError(
      "Gemini free-tier rate limit reached. Wait a minute and try again, or check usage at aistudio.google.com. " +
        "Stock photos still work without Gemini. Optional: set GEMINI_MODEL to gemini-2.5-flash.",
      "QUOTA_EXCEEDED"
    );
  }

  if (
    lower.includes("403") ||
    lower.includes("api key not valid") ||
    lower.includes("permission denied") ||
    lower.includes("unregistered callers")
  ) {
    return new GeminiApiError(
      "Invalid or unauthorized Gemini API key. Create a free key at aistudio.google.com/apikey (new keys start with AQ.; older keys start with AIzaSy) " +
        "and set it as GEMINI_API_KEY in Vercel.",
      "INVALID_KEY"
    );
  }

  if (
    lower.includes("404") ||
    (lower.includes("not found") && lower.includes("model")) ||
    lower.includes("is not supported")
  ) {
    return new GeminiApiError(
      `Gemini model "${getGeminiModel()}" is not available on your plan. Set GEMINI_MODEL to gemini-2.5-flash or gemini-1.5-flash.`,
      "MODEL_NOT_FOUND"
    );
  }

  return new GeminiApiError(msg, "UNKNOWN");
}

export function geminiErrorToHttp(err: unknown): {
  message: string;
  status: number;
  code?: GeminiErrorCode;
} {
  if (err instanceof Error && err.message === "GEMINI_NOT_CONFIGURED") {
    return {
      message:
        "Add a free Gemini API key as GEMINI_API_KEY to use text editing. Get one at aistudio.google.com/apikey (AQ. or AIzaSy). Stock photos work without a key.",
      status: 503,
    };
  }

  const keyWarning = getGeminiKeyWarning();
  if (err instanceof GeminiApiError) {
    const message =
      err.code === "INVALID_KEY" && keyWarning ? keyWarning : err.message;
    const status =
      err.code === "QUOTA_EXCEEDED"
        ? 429
        : err.code === "INVALID_KEY" || err.code === "MODEL_NOT_FOUND"
          ? 503
          : 500;
    return { message, status, code: err.code };
  }

  const message = err instanceof Error ? err.message : "AI request failed";
  return { message, status: 500 };
}

type ContentPart = { text: string };

export async function generateGeminiText(
  parts: ContentPart[],
  options?: { maxRetries?: number }
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_NOT_CONFIGURED");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelCandidates = getGeminiModelCandidates();
  const maxRetries = options?.maxRetries ?? 3;

  let lastError: unknown;

  for (let modelIndex = 0; modelIndex < modelCandidates.length; modelIndex++) {
    const modelName = modelCandidates[modelIndex];
    const model = genAI.getGenerativeModel({ model: modelName });
    const hasNextModel = modelIndex < modelCandidates.length - 1;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await model.generateContent(parts);
        return result.response.text();
      } catch (err) {
        lastError = err;

        if (shouldFallbackToNextModel(err) && hasNextModel) {
          break;
        }

        const msg = err instanceof Error ? err.message : String(err);
        const isRetryable =
          msg.includes("429") ||
          msg.toLowerCase().includes("quota") ||
          msg.toLowerCase().includes("resource exhausted");

        if (isRetryable && attempt < maxRetries) {
          const retryAfter =
            parseRetryAfterMs(msg) ?? Math.min(1000 * 2 ** attempt, 30_000);
          await sleep(retryAfter);
          continue;
        }

        throw classifyGeminiError(err);
      }
    }
  }

  throw classifyGeminiError(lastError);
}

export async function generateVehicleSuggestions(
  vehicle: Partial<VehicleInput>,
  userPrompt: string,
  action: VehicleAiAction = "custom"
): Promise<VehicleAiSuggestions> {
  const vehicleContext = JSON.stringify(
    {
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
      description: vehicle.description,
      status: vehicle.status,
    },
    null,
    2
  );

  const actionPrompt =
    action === "improve_description"
      ? "Rewrite only the listing description to be more compelling. Do not change other fields unless the owner request asks for it."
      : action === "fill_fields"
        ? "Review all listing text fields (description, trim, color, engine_size) and suggest improvements where empty or weak. Fill gaps using only plausible values from the specs provided."
        : "";

  const systemPrompt = `You are an expert automotive listing copywriter for True Goshen Auto, a premium vehicle dealership in Ghana and West Africa.
Given the current vehicle listing data and the owner's request, return ONLY valid JSON (no markdown fences) with this shape:
{
  "description": "improved listing description or omit if unchanged",
  "title": "suggested listing title e.g. 2024 BYD Atto 3 Premium or omit",
  "fieldUpdates": { "description": "...", "trim": "...", "color": "..." },
  "notes": "brief note about what you changed"
}
Rules:
- Keep descriptions professional, persuasive, and accurate to the specs provided.
- Do not invent specs (mileage, price, VIN) that are not in the input.
- fieldUpdates may only include: description, trim, color, engine_size, make, model, year.
- Omit keys you are not changing.
- You write listing text only. You cannot create or return image URLs or photos.
${actionPrompt ? `\nTask focus: ${actionPrompt}` : ""}`;

  const raw = (
    await generateGeminiText([
      { text: systemPrompt },
      {
        text: `Current vehicle:\n${vehicleContext}\n\nOwner request:\n${userPrompt}`,
      },
    ])
  ).trim();

  const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  let parsed: VehicleAiSuggestions;
  try {
    parsed = JSON.parse(jsonText) as VehicleAiSuggestions;
  } catch {
    parsed = { description: raw, notes: "AI returned plain text; applied as description." };
  }

  return parsed;
}
