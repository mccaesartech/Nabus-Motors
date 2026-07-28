import { describe, expect, it } from "vitest";
import {
  applyVehicleAiChanges,
  applyVisionColorGuard,
  buildVehicleAiSystemPrompt,
  buildVisionOnlyColorPrompt,
  parseVisionOnlyColorResponse,
  resolveVehicleAiTaskFocus,
  sanitizeVehicleAiChanges,
} from "@/lib/ai/vehicle-ai-chat";
import {
  DEFAULT_GEMINI_INVENTORY_MODEL,
  DEFAULT_GEMINI_MODEL,
  getGeminiInventoryModelCandidates,
  getGeminiModelCandidates,
} from "@/lib/ai/gemini";
import { isPhotoRequest } from "@/lib/ai/photo-request";
import {
  collectVisionImageUrls,
  exteriorColorsMatch,
  isColorDetectionRequest,
  isDescriptionRewriteRequest,
  isFillFromPhotosRequest,
  isInspectionSummaryRequest,
  isSparseVehicleListing,
  isWarrantyNotesRequest,
  normalizeSuggestedColor,
  reconcileAiColorSuggestion,
  scrubFormColorFromText,
  selectVehicleAiQuickActions,
  stockPhotoColorHints,
} from "@/lib/ai/vehicle-ai-vision";
import type { VehicleAiChatVehicleState } from "@/lib/ai/vehicle-ai-chat-types";

function emptyVehicle(
  overrides: Partial<VehicleAiChatVehicleState> = {}
): VehicleAiChatVehicleState {
  return {
    make: "",
    model: "",
    year: 2024,
    trim: "",
    price: 0,
    mileage: 0,
    fuel_type: "Petrol",
    transmission: "Automatic",
    condition: "Used",
    body_type: "SUV",
    location: "",
    engine_size: "",
    color: "",
    vin: "",
    description: "",
    featured: false,
    status: "available",
    images: [],
    gallery: { exterior: [], interior: [], engine: [], other: [] },
    ...overrides,
  };
}

describe("gemini inventory model selection", () => {
  it("defaults general chat to Flash and inventory to Pro with Flash fallback", () => {
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-2.5-flash");
    expect(DEFAULT_GEMINI_INVENTORY_MODEL).toBe("gemini-2.5-pro");
    const general = getGeminiModelCandidates();
    const inventory = getGeminiInventoryModelCandidates();
    expect(general).toContain("gemini-2.5-flash");
    expect(inventory).toContain("gemini-2.5-pro");
    expect(inventory).toContain("gemini-2.5-flash");
    // Without an explicit GEMINI_MODEL override, inventory prefers Pro.
    if (!process.env.GEMINI_MODEL?.trim()) {
      expect(general[0]).toBe("gemini-2.5-flash");
      expect(inventory[0]).toBe("gemini-2.5-pro");
    }
  });
});

describe("vehicle-ai-vision helpers", () => {
  it("collects exterior photos first and caps count", () => {
    const urls = collectVisionImageUrls(
      {
        exterior: ["https://cdn.example.com/e1.jpg", "https://cdn.example.com/e2.jpg"],
        interior: ["https://cdn.example.com/i1.jpg"],
        engine: ["https://cdn.example.com/eng1.jpg"],
        other: ["https://cdn.example.com/o1.jpg", "https://cdn.example.com/o2.jpg"],
      },
      ["https://cdn.example.com/legacy.jpg"],
      4
    );
    expect(urls).toEqual([
      "https://cdn.example.com/e1.jpg",
      "https://cdn.example.com/e2.jpg",
      "https://cdn.example.com/legacy.jpg",
      "https://cdn.example.com/i1.jpg",
    ]);
  });

  it("maps annotated Pexels URLs to stock color hints", () => {
    const url =
      "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress";
    expect(stockPhotoColorHints([url, "https://cdn.example.com/real.jpg"])).toEqual([
      { url, color: "Atomic Grey" },
    ]);
  });

  it("normalizes suggested colors onto the palette when possible", () => {
    expect(normalizeSuggestedColor("  atomic grey ")).toBe("Gray");
    expect(normalizeSuggestedColor("gray")).toBe("Gray");
    expect(normalizeSuggestedColor("dark blue")).toBe("Navy");
    expect(normalizeSuggestedColor("Alpine White")).toBe("Alpine White");
  });

  it("detects sparse listings", () => {
    expect(isSparseVehicleListing(emptyVehicle())).toBe(true);
    expect(
      isSparseVehicleListing(
        emptyVehicle({
          make: "BYD",
          model: "Seal",
          color: "Navy",
          description: "A long enough description that is not sparse anymore for fill heuristics.",
          price: 45000,
        })
      )
    ).toBe(false);
  });

  it("detects fill-from-photos and color-detection intents", () => {
    expect(isFillFromPhotosRequest("Fill listing from photos")).toBe(true);
    expect(isFillFromPhotosRequest("Detect exterior color from photos")).toBe(true);
    expect(isFillFromPhotosRequest("What color is this car?")).toBe(true);
    expect(isFillFromPhotosRequest("Correct fields from photos")).toBe(true);
    expect(isColorDetectionRequest("Detect exterior color from photos")).toBe(true);
    expect(isColorDetectionRequest("What color is this car?")).toBe(true);
    expect(isColorDetectionRequest("Fill listing from photos")).toBe(false);
    expect(isPhotoRequest("Fill listing from photos")).toBe(false);
    expect(isPhotoRequest("Find stock photos (free)")).toBe(true);
  });

  it("detects inspection, warranty, and description rewrite intents", () => {
    expect(isInspectionSummaryRequest("Write inspection summary")).toBe(true);
    expect(isWarrantyNotesRequest("Draft warranty notes")).toBe(true);
    expect(isDescriptionRewriteRequest("Improve the listing description")).toBe(true);
    expect(isDescriptionRewriteRequest("Edit description")).toBe(true);
    expect(isDescriptionRewriteRequest("Fill listing from photos")).toBe(false);
  });

  it("routes task focus for smarter prompts", () => {
    expect(resolveVehicleAiTaskFocus("Fill listing from photos", true)).toBe("fill");
    expect(resolveVehicleAiTaskFocus("Correct fields from photos", false)).toBe("correct");
    expect(resolveVehicleAiTaskFocus("Write inspection summary", false)).toBe("inspection");
    expect(resolveVehicleAiTaskFocus("Draft warranty notes", false)).toBe("warranty");
    expect(resolveVehicleAiTaskFocus("Improve the listing description", false)).toBe(
      "description"
    );
  });

  it("selects vision-first quick actions for sparse listings with photos", () => {
    const actions = selectVehicleAiQuickActions({
      sparse: true,
      hasGalleryPhotos: true,
      hasDescription: false,
      hasInspection: false,
      hasWarranty: false,
    });
    expect(actions[0]).toBe("Fill listing from photos");
    expect(actions).toContain("Write inspection summary");
    expect(actions).toContain("Draft warranty notes");
    expect(actions).toContain("Enhance photos (4K)");
  });

  it("scrubs form color tokens from description text", () => {
    expect(scrubFormColorFromText("Beautiful Red Camry in Accra", "Red")).toBe(
      "Beautiful [COLOR REDACTED] Camry in Accra"
    );
    expect(scrubFormColorFromText("Charcoal Gray metallic", "Charcoal Gray")).toBe(
      "[COLOR REDACTED] metallic"
    );
  });
});

describe("sanitizeVehicleAiChanges color", () => {
  it("canonicalizes AI color suggestions", () => {
    expect(sanitizeVehicleAiChanges({ color: "midnight black" })).toEqual({
      color: "Black",
    });
    expect(sanitizeVehicleAiChanges({ color: "gray", make: "Toyota" })).toEqual({
      make: "Toyota",
      color: "Gray",
    });
  });

  it("accepts inspection, warranty, and seating fields", () => {
    expect(
      sanitizeVehicleAiChanges({
        inspection_summary: "Clean exterior, light seat wear.",
        warranty_notes: "Dealer assurance [confirm months].",
        seating_capacity: 5,
        drivetrain: "AWD",
      })
    ).toEqual({
      inspection_summary: "Clean exterior, light seat wear.",
      warranty_notes: "Dealer assurance [confirm months].",
      seating_capacity: 5,
      drivetrain: "AWD",
    });
  });
});

describe("vision-only color prompt has zero form context", () => {
  it("never embeds vehicle form state or photo URLs", () => {
    const prompt = buildVisionOnlyColorPrompt();
    expect(prompt).toContain("paint-color detector");
    expect(prompt).toContain("ONLY at the attached photo");
    expect(prompt).not.toContain("StaffTypedTomato");
    expect(prompt).not.toContain("currentVehicle");
    expect(prompt).not.toContain("https://");
    expect(prompt).not.toContain("gallery");
    expect(prompt).toMatch(/prefer one of these labels/i);
  });

  it("parses dedicated detector JSON without falling back to form labels", () => {
    expect(parseVisionOnlyColorResponse('{"color":"White","confidence":"high"}')).toBe(
      "White"
    );
    expect(parseVisionOnlyColorResponse('{"color":null,"confidence":"none"}')).toBeNull();
    expect(parseVisionOnlyColorResponse("not json at all")).toBeNull();
  });
});

describe("vision color vs form label", () => {
  it("redacts form color from the prompt when photos are present", () => {
    const prompt = buildVehicleAiSystemPrompt(
      emptyVehicle({
        color: "StaffTypedTomato",
        make: "WrongMake",
        description: "StaffTypedTomato beauty with leather seats",
      }),
      {
        visionAttached: true,
        visionUrlCount: 2,
        forceVisionFill: true,
        galleryPhotoCount: 2,
      }
    );
    expect(prompt).toContain("ignore_this_color_label");
    expect(prompt).toContain("REDACTED");
    expect(prompt).toContain("VISION PROTOCOL");
    expect(prompt).toContain("vision-only paint detector");
    expect(prompt).toContain("COMPLETE LISTING FILL");
    expect(prompt).not.toMatch(/"color"\s*:\s*"StaffTypedTomato"/);
    expect(prompt).not.toContain("color_label_on_form");
    // Form color must not appear anywhere — including description scrub.
    expect(prompt).not.toContain("StaffTypedTomato");
    expect(prompt).toContain("[COLOR REDACTED]");
  });

  it("keeps form color only when no photos exist", () => {
    const prompt = buildVehicleAiSystemPrompt(emptyVehicle({ color: "Red" }), {
      visionAttached: false,
      galleryPhotoCount: 0,
    });
    expect(prompt).toContain("NO PHOTOS ATTACHED");
    expect(prompt).toMatch(/"color": "Red"/);
  });

  it("uses inspection / warranty task directives", () => {
    const inspection = buildVehicleAiSystemPrompt(emptyVehicle(), {
      taskFocus: "inspection",
    });
    expect(inspection).toContain("INSPECTION SUMMARY");
    const warranty = buildVehicleAiSystemPrompt(emptyVehicle(), {
      taskFocus: "warranty",
    });
    expect(warranty).toContain("WARRANTY NOTES");
  });

  it("form Red + vision White → suggestion is White (not Red)", () => {
    const reconciled = reconcileAiColorSuggestion({
      formColor: "Red",
      suggestedColor: "Red", // chat model echoed the form label
      visionAttached: true,
      galleryPhotoCount: 2,
      visionDetectedColor: "White", // dedicated detector wins
    });
    expect(reconciled.color).toBe("White");
    expect(reconciled.visionUnavailable).toBe(false);

    const guarded = applyVisionColorGuard(
      { reply: "Looks like a Camry.", changes: { color: "Red", make: "Toyota" } },
      {
        formColor: "Red",
        visionAttached: true,
        galleryPhotoCount: 2,
        visionDetectedColor: "White",
      }
    );
    expect(guarded.changes?.color).toBe("White");
    expect(guarded.changes?.make).toBe("Toyota");
    expect(guarded.changes?.color).not.toBe("Red");

    const applied = applyVehicleAiChanges(
      {
        make: "Toyota",
        model: "Camry",
        year: 2020,
        trim: "",
        price: 0,
        mileage: 0,
        fuel_type: "Petrol",
        transmission: "Automatic",
        condition: "Used",
        body_type: "Sedan",
        location: "Accra",
        engine_size: "",
        color: "Red",
        vin: "",
        description: "",
        featured: false,
        status: "available",
        images: [],
      },
      { exterior: ["https://cdn.example.com/car.jpg"], interior: [], engine: [], other: [] },
      { color: "White", inspection_summary: "Clean body panels." }
    );
    expect(applied.form.color).toBe("White");
    expect(applied.form.inspection_summary).toBe("Clean body panels.");
  });

  it("refuses chat/form color when vision attached but dedicated detection fails", () => {
    const reconciled = reconcileAiColorSuggestion({
      formColor: "Red",
      suggestedColor: "Red",
      visionAttached: true,
      galleryPhotoCount: 2,
      visionDetectedColor: null,
    });
    expect(reconciled.color).toBeUndefined();
    expect(reconciled.visionUnavailable).toBe(true);

    const guarded = applyVisionColorGuard(
      { reply: "Color is Red.", changes: { color: "Red", make: "Toyota" } },
      {
        formColor: "Red",
        visionAttached: true,
        galleryPhotoCount: 2,
        visionDetectedColor: null,
      }
    );
    expect(guarded.changes?.color).toBeUndefined();
    expect(guarded.changes?.make).toBe("Toyota");
    expect(guarded.reply).toMatch(/couldn't read the exterior paint/i);
  });

  it("refuses to echo form color when gallery photos exist but vision failed", () => {
    const reconciled = reconcileAiColorSuggestion({
      formColor: "Red",
      suggestedColor: "Red",
      visionAttached: false,
      galleryPhotoCount: 3,
    });
    expect(reconciled.color).toBeUndefined();
    expect(reconciled.refusedFormEcho).toBe(true);
    expect(reconciled.visionUnavailable).toBe(true);

    const guarded = applyVisionColorGuard(
      { reply: "Color is Red.", changes: { color: "Red" } },
      { formColor: "Red", visionAttached: false, galleryPhotoCount: 3 }
    );
    expect(guarded.changes?.color).toBeUndefined();
    expect(guarded.reply).toMatch(/couldn't read the exterior paint|couldn't analyze/i);
  });

  it("matches exterior color labels after normalization", () => {
    expect(exteriorColorsMatch("gray", "Grey")).toBe(true);
    expect(exteriorColorsMatch("navy blue", "Navy")).toBe(true);
    expect(exteriorColorsMatch("Red", "White")).toBe(false);
  });
});

describe("buildVehicleAiSystemPrompt", () => {
  it("asks for photos when none are attached", () => {
    const prompt = buildVehicleAiSystemPrompt(emptyVehicle(), { visionAttached: false });
    expect(prompt).toContain("NO PHOTOS ATTACHED");
    expect(prompt).toContain("senior automotive inventory intelligence");
  });

  it("does not tell the model it cannot enhance photos", () => {
    const prompt = buildVehicleAiSystemPrompt(emptyVehicle(), { visionAttached: true });
    expect(prompt).toMatch(/photo quality enhance/i);
    expect(prompt).toMatch(/never claim you cannot enhance/i);
    expect(prompt).not.toMatch(/You cannot upload files or apply color filters/i);
  });
});
