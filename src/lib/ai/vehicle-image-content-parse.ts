export type ParsedVehicleImageContentJson = {
  isVehicle: boolean;
  confidence: "high" | "medium" | "low";
  reason: string;
};

/**
 * Parse Gemini JSON for vehicle-content classification.
 * Kept free of server-only so unit tests can import it.
 */
export function parseVehicleImageContentJson(raw: string): ParsedVehicleImageContentJson | null {
  const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const parsed = JSON.parse(jsonText) as {
      isVehicle?: unknown;
      confidence?: unknown;
      reason?: unknown;
    };
    if (typeof parsed.isVehicle !== "boolean") return null;
    const confidenceRaw = String(parsed.confidence ?? "medium").toLowerCase();
    const confidence =
      confidenceRaw === "high" || confidenceRaw === "low" ? confidenceRaw : "medium";
    return {
      isVehicle: parsed.isVehicle,
      confidence,
      reason:
        typeof parsed.reason === "string" && parsed.reason.trim()
          ? parsed.reason.trim()
          : parsed.isVehicle
            ? "Looks like a vehicle photo."
            : "Does not look like a vehicle photo.",
    };
  } catch {
    return null;
  }
}
