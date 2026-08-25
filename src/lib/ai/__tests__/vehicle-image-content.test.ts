import { describe, expect, it } from "vitest";
import { parseVehicleImageContentJson } from "@/lib/ai/vehicle-image-content-parse";

describe("parseVehicleImageContentJson", () => {
  it("parses plain JSON vehicle verdict", () => {
    const parsed = parseVehicleImageContentJson(
      JSON.stringify({
        isVehicle: true,
        confidence: "high",
        reason: "Shows a white SUV exterior.",
      })
    );
    expect(parsed).toEqual({
      isVehicle: true,
      confidence: "high",
      reason: "Shows a white SUV exterior.",
    });
  });

  it("parses fenced JSON non-vehicle verdict", () => {
    const parsed = parseVehicleImageContentJson(`\`\`\`json
{"isVehicle":false,"confidence":"high","reason":"This is a plate of food."}
\`\`\``);
    expect(parsed?.isVehicle).toBe(false);
    expect(parsed?.confidence).toBe("high");
    expect(parsed?.reason).toContain("food");
  });

  it("returns null for invalid payloads", () => {
    expect(parseVehicleImageContentJson("not json")).toBeNull();
    expect(parseVehicleImageContentJson('{"confidence":"high"}')).toBeNull();
  });
});
