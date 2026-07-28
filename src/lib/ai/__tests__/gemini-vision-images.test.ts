import { describe, expect, it } from "vitest";
import {
  resolveInlineImageMime,
  sniffImageMimeFromBytes,
} from "@/lib/ai/image-mime-sniff";

describe("sniffImageMimeFromBytes", () => {
  it("detects JPEG / PNG / WebP from magic bytes", () => {
    expect(sniffImageMimeFromBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "image/jpeg"
    );
    expect(
      sniffImageMimeFromBytes(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    ).toBe("image/png");

    const webp = new Uint8Array(12);
    webp.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
    webp.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
    expect(sniffImageMimeFromBytes(webp)).toBe("image/webp");
  });

  it("returns null for non-image bytes", () => {
    expect(sniffImageMimeFromBytes(new TextEncoder().encode("not-an-image"))).toBeNull();
  });
});

describe("resolveInlineImageMime", () => {
  it("recovers JPEG when CDN returns application/octet-stream", () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(
      resolveInlineImageMime(
        "application/octet-stream",
        jpeg,
        "https://cdn.example.com/car.jpg"
      )
    ).toBe("image/jpeg");
  });
});
