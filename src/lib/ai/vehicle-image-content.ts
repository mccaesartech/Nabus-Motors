import "server-only";

import { generateGeminiText, getGeminiApiKey } from "@/lib/ai/gemini";
import { parseVehicleImageContentJson } from "@/lib/ai/vehicle-image-content-parse";

export type VehicleImageContentVerdict = "vehicle" | "non_vehicle" | "uncertain";

export type VehicleImageContentCheck = {
  /** True when Gemini ran and returned a usable verdict. */
  checked: boolean;
  /** True when Gemini is configured (key present). */
  configured: boolean;
  verdict: VehicleImageContentVerdict;
  reason: string;
  /** True when the image should soft-block unless the admin confirms intentional. */
  requiresConfirmation: boolean;
  /** True when check was skipped (no key / AI error) and upload may proceed. */
  skipped: boolean;
};

function failOpen(reason: string, configured: boolean): VehicleImageContentCheck {
  return {
    checked: false,
    configured,
    verdict: "uncertain",
    reason,
    requiresConfirmation: false,
    skipped: true,
  };
}

/**
 * Lightweight Gemini vision check: is this primarily a car/vehicle listing photo?
 * Fail-open when Gemini is unavailable so production uploads are not blocked.
 */
export async function checkVehicleImageContent(
  buffer: Buffer,
  mimeType: string
): Promise<VehicleImageContentCheck> {
  const configured = Boolean(getGeminiApiKey());
  if (!configured) {
    console.warn(
      "[vehicle-image-content] GEMINI_API_KEY not set — skipping non-vehicle image check (fail-open)."
    );
    return failOpen("Vehicle image check skipped (Gemini not configured).", false);
  }

  const prompt = `You are screening dealership inventory uploads for Nabus Motors.
Decide if this image is primarily a photo of a road vehicle suitable for a car listing (car, SUV, truck, van, bus, motorcycle, or clear vehicle detail: exterior, interior cabin, engine bay, wheel/tire, dashboard, VIN plate).
Return ONLY valid JSON (no markdown):
{"isVehicle":true|false,"confidence":"high"|"medium"|"low","reason":"short reason"}
Rules:
- isVehicle true for real vehicle photos or close-up vehicle parts used in listings.
- isVehicle false for people-only selfies, documents, screenshots, memes, food, landscapes with no vehicle, random objects, logos alone, or anything that is clearly not vehicle inventory media.
- Prefer isVehicle false with high confidence when the subject is obviously not a vehicle.
- Prefer isVehicle true when a vehicle is the main subject even if the shot is imperfect.`;

  try {
    const raw = await generateGeminiText(
      [
        { text: prompt },
        {
          inlineData: {
            data: buffer.toString("base64"),
            mimeType,
          },
        },
      ],
      { inventoryModel: true, jsonMode: true, temperature: 0.1, maxRetries: 1 }
    );

    const parsed = parseVehicleImageContentJson(raw);
    if (!parsed) {
      console.warn(
        "[vehicle-image-content] Could not parse Gemini response — fail-open.",
        raw.slice(0, 200)
      );
      return failOpen("Vehicle image check could not be parsed; upload allowed.", true);
    }

    if (parsed.isVehicle) {
      return {
        checked: true,
        configured: true,
        verdict: "vehicle",
        reason: parsed.reason,
        requiresConfirmation: false,
        skipped: false,
      };
    }

    return {
      checked: true,
      configured: true,
      verdict: "non_vehicle",
      reason: parsed.reason,
      requiresConfirmation: true,
      skipped: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      "[vehicle-image-content] Gemini check failed — fail-open:",
      message.slice(0, 300)
    );
    return failOpen("Vehicle image check unavailable; upload allowed.", true);
  }
}
