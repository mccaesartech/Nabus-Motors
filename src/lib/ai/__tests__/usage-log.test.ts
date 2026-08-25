import { describe, expect, it } from "vitest";
import {
  aiUsageActionLabel,
  buildVehicleAiLabel,
  inferAiChatAction,
  truncateAiPreview,
} from "@/lib/ai/usage-log-shared";

describe("ai usage log helpers", () => {
  it("builds vehicle labels", () => {
    expect(buildVehicleAiLabel({ year: 2020, make: "Toyota", model: "Camry" })).toBe(
      "2020 Toyota Camry"
    );
    expect(buildVehicleAiLabel({ make: "Toyota", model: "" })).toBe("Toyota");
    expect(buildVehicleAiLabel({})).toBeNull();
  });

  it("infers chat actions from prompts", () => {
    expect(inferAiChatAction("Fill listing from photos")).toBe("fill_from_photos");
    expect(inferAiChatAction("Detect exterior color from photos")).toBe("detect_color");
    expect(inferAiChatAction("Improve the listing description")).toBe("improve_description");
    expect(inferAiChatAction("Write a professional description")).toBe("generate_description");
    expect(inferAiChatAction("Hello")).toBe("ai_chat");
  });

  it("truncates previews and labels actions", () => {
    expect(truncateAiPreview("  hello   world  ")).toBe("hello world");
    expect(truncateAiPreview("x".repeat(300))?.endsWith("...")).toBe(true);
    expect(aiUsageActionLabel("suggest_photos")).toBe("Suggest stock photos");
    expect(aiUsageActionLabel("custom_thing")).toBe("custom_thing");
  });
});
