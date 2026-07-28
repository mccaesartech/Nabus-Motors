import { describe, expect, it } from "vitest";
import {
  colorAdjustReply,
  enhanceImageReply,
  ENHANCE_PHOTOS_4K_ACTION,
  isColorAdjustRequest,
  isImageEnhanceRequest,
  parseColorAdjustPreset,
} from "@/lib/ai/image-adjustments";
import { replaceGalleryUrl } from "@/lib/ai/gallery-commands";

describe("image adjust proposals", () => {
  it("wording asks admin to approve before gallery changes", () => {
    const reply = colorAdjustReply("warm");
    expect(reply).toMatch(/Approve/i);
    expect(reply).toMatch(/nothing changes until you confirm/i);
    expect(reply).not.toMatch(/^Applied/);
  });

  it("parseColorAdjustPreset maps warm chip text", () => {
    expect(parseColorAdjustPreset("Warm up colors")).toBe("warm");
  });

  it("replaceGalleryUrl swaps only the edited photo (pending apply)", () => {
    const gallery = {
      exterior: ["https://cdn.example.com/before.jpg", "https://cdn.example.com/other.jpg"],
      interior: [],
      engine: [],
      other: [],
    };
    const next = replaceGalleryUrl(
      gallery,
      "https://cdn.example.com/before.jpg",
      "https://cdn.example.com/after.jpg"
    );
    expect(next.exterior).toEqual([
      "https://cdn.example.com/after.jpg",
      "https://cdn.example.com/other.jpg",
    ]);
    expect(gallery.exterior[0]).toBe("https://cdn.example.com/before.jpg");
  });
});

describe("image enhance / 4K request detection", () => {
  it("detects 4K, upscale, enhance, and quality upgrade phrasing", () => {
    expect(isImageEnhanceRequest("upgrade image quality to 4K")).toBe(true);
    expect(isImageEnhanceRequest("Please upscale this photo")).toBe(true);
    expect(isImageEnhanceRequest("enhance the photo quality")).toBe(true);
    expect(isImageEnhanceRequest("make the image higher quality")).toBe(true);
    expect(isImageEnhanceRequest("sharpen the photo")).toBe(true);
    expect(isImageEnhanceRequest(ENHANCE_PHOTOS_4K_ACTION)).toBe(true);
  });

  it("does not steal description or color-filter requests", () => {
    expect(isImageEnhanceRequest("Improve the listing description")).toBe(false);
    expect(isImageEnhanceRequest("Warm up colors")).toBe(false);
    expect(isImageEnhanceRequest("Increase contrast")).toBe(false);
    expect(isColorAdjustRequest("Warm up colors")).toBe(true);
    expect(parseColorAdjustPreset("upgrade image quality to 4K")).toBeNull();
  });

  it("enhance reply asks for Approve and does not refuse", () => {
    const reply = enhanceImageReply();
    expect(reply).toMatch(/Approve/i);
    expect(reply).toMatch(/3840/i);
    expect(reply).not.toMatch(/cannot/i);
    expect(colorAdjustReply("enhance")).toBe(reply);
  });
});
