import { describe, expect, it } from "vitest";
import {
  buildTestimonialAvatarUrl,
  getNameInitials,
  resolveTestimonialImage,
} from "@/lib/site-content/media-url";

describe("getNameInitials", () => {
  it("uses first and last word for two-part names", () => {
    expect(getNameInitials("Ama Mensah")).toBe("AM");
    expect(getNameInitials("Samuel Boateng")).toBe("SB");
  });

  it("uses first and last word for multi-part names", () => {
    expect(getNameInitials("Mary Ann Boateng")).toBe("MB");
    expect(getNameInitials("Jean-Luc Picard")).toBe("JP");
  });

  it("uses up to two letters for a single name", () => {
    expect(getNameInitials("Grace")).toBe("GR");
    expect(getNameInitials("A")).toBe("A");
  });

  it("trims whitespace and ignores empty input", () => {
    expect(getNameInitials("  Ama Mensah  ")).toBe("AM");
    expect(getNameInitials("")).toBe("?");
    expect(getNameInitials("   ")).toBe("?");
  });
});

describe("buildTestimonialAvatarUrl / resolveTestimonialImage", () => {
  it("encodes the displayed name into the fallback avatar URL", () => {
    const url = buildTestimonialAvatarUrl("Grace Adjei", 1);
    expect(url).toContain("ui-avatars.com/api/");
    expect(url).toContain("name=Grace+Adjei");
  });

  it("falls back to a slot label when the name is empty", () => {
    const url = buildTestimonialAvatarUrl("", 2);
    expect(url).toContain("name=Client+3");
  });

  it("uses the name for placeholder avatars when image is empty", () => {
    const url = resolveTestimonialImage("", 0, "Patricia Owusu");
    expect(url).toContain("name=Patricia+Owusu");
    expect(url).not.toContain("Kwame");
  });

  it("keeps a valid custom image URL", () => {
    const custom = "https://cdn.example.com/avatar.jpg";
    expect(resolveTestimonialImage(custom, 0, "Anyone")).toBe(custom);
  });
});
