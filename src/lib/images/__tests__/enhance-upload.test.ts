import { afterEach, describe, expect, it, vi } from "vitest";

const toBuffer = vi.fn();
const metadata = vi.fn();
const chain = {
  rotate: vi.fn(),
  resize: vi.fn(),
  sharpen: vi.fn(),
  linear: vi.fn(),
  modulate: vi.fn(),
  jpeg: vi.fn(),
  png: vi.fn(),
  webp: vi.fn(),
  metadata,
  toBuffer,
};

function resetChain() {
  for (const fn of Object.values(chain)) {
    if (typeof fn === "function" && "mockReset" in fn) {
      (fn as ReturnType<typeof vi.fn>).mockReset();
    }
  }
  chain.rotate.mockReturnValue(chain);
  chain.resize.mockReturnValue(chain);
  chain.sharpen.mockReturnValue(chain);
  chain.linear.mockReturnValue(chain);
  chain.modulate.mockReturnValue(chain);
  chain.jpeg.mockReturnValue(chain);
  chain.png.mockReturnValue(chain);
  chain.webp.mockReturnValue(chain);
  metadata.mockResolvedValue({ width: 1200, height: 800, hasAlpha: false });
  toBuffer.mockResolvedValue(Buffer.from("enhanced-bytes"));
}

vi.mock("sharp", () => ({
  default: vi.fn(() => chain),
}));

describe("UPLOAD_ENHANCE options", () => {
  it("keeps sharpening and contrast in a moderate range", async () => {
    const { UPLOAD_ENHANCE } = await import("@/lib/images/enhance-upload");

    expect(UPLOAD_ENHANCE.maxDimension).toBe(4096);
    expect(UPLOAD_ENHANCE.sharpen.sigma).toBeGreaterThan(0);
    expect(UPLOAD_ENHANCE.sharpen.sigma).toBeLessThanOrEqual(1.5);
    expect(UPLOAD_ENHANCE.contrast.multiplier).toBeGreaterThan(1);
    expect(UPLOAD_ENHANCE.contrast.multiplier).toBeLessThanOrEqual(1.2);
    expect(UPLOAD_ENHANCE.jpegQuality).toBeGreaterThanOrEqual(80);
    expect(UPLOAD_ENHANCE.jpegQuality).toBeLessThanOrEqual(95);
  });
});

describe("isEnhancableImageMime / mimeToImageExt", () => {
  it("accepts jpeg/png/webp and maps extensions", async () => {
    const { isEnhancableImageMime, mimeToImageExt } = await import(
      "@/lib/images/enhance-upload"
    );

    expect(isEnhancableImageMime("image/jpeg")).toBe(true);
    expect(isEnhancableImageMime("image/png")).toBe(true);
    expect(isEnhancableImageMime("image/webp")).toBe(true);
    expect(isEnhancableImageMime("video/mp4")).toBe(false);
    expect(isEnhancableImageMime("application/pdf")).toBe(false);

    expect(mimeToImageExt("image/jpeg")).toBe("jpg");
    expect(mimeToImageExt("image/png")).toBe("png");
    expect(mimeToImageExt("image/webp")).toBe("webp");
  });
});

describe("enhanceUploadImage", () => {
  afterEach(() => {
    resetChain();
    vi.clearAllMocks();
  });

  it("skips non-image mime types without calling sharp", async () => {
    resetChain();
    const sharp = (await import("sharp")).default;
    const { enhanceUploadImage } = await import("@/lib/images/enhance-upload");
    const input = Buffer.from("not-an-image");

    const result = await enhanceUploadImage(input, "video/mp4");

    expect(result).toEqual({
      buffer: input,
      mime: "video/mp4",
      ext: "bin",
      enhanced: false,
    });
    expect(sharp).not.toHaveBeenCalled();
  });

  it("applies rotate, sharpen, contrast, and encodes jpeg for photos", async () => {
    resetChain();
    const sharp = (await import("sharp")).default;
    const { enhanceUploadImage, UPLOAD_ENHANCE } = await import(
      "@/lib/images/enhance-upload"
    );
    const input = Buffer.from("fake-jpeg");

    const result = await enhanceUploadImage(input, "image/jpeg");

    expect(sharp).toHaveBeenCalled();
    expect(chain.rotate).toHaveBeenCalled();
    expect(chain.sharpen).toHaveBeenCalledWith(UPLOAD_ENHANCE.sharpen);
    expect(chain.linear).toHaveBeenCalledWith(
      UPLOAD_ENHANCE.contrast.multiplier,
      UPLOAD_ENHANCE.contrast.offset
    );
    expect(chain.modulate).toHaveBeenCalledWith(UPLOAD_ENHANCE.modulate);
    expect(chain.jpeg).toHaveBeenCalled();
    expect(result.enhanced).toBe(true);
    expect(result.mime).toBe("image/jpeg");
    expect(result.ext).toBe("jpg");
    expect(result.buffer.toString()).toBe("enhanced-bytes");
  });

  it("downscales when either dimension exceeds the cap", async () => {
    resetChain();
    metadata.mockResolvedValue({ width: 6000, height: 4000, hasAlpha: false });
    const { enhanceUploadImage, UPLOAD_ENHANCE } = await import(
      "@/lib/images/enhance-upload"
    );

    await enhanceUploadImage(Buffer.from("big"), "image/jpeg");

    expect(chain.resize).toHaveBeenCalledWith({
      width: UPLOAD_ENHANCE.maxDimension,
      height: UPLOAD_ENHANCE.maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    });
  });

  it("preserves PNG when the source has an alpha channel", async () => {
    resetChain();
    metadata.mockResolvedValue({ width: 400, height: 400, hasAlpha: true });
    const { enhanceUploadImage } = await import("@/lib/images/enhance-upload");

    const result = await enhanceUploadImage(Buffer.from("png"), "image/png");

    expect(chain.png).toHaveBeenCalled();
    expect(result.mime).toBe("image/png");
    expect(result.ext).toBe("png");
    expect(result.enhanced).toBe(true);
  });

  it("fails soft and returns the original when sharp throws", async () => {
    resetChain();
    metadata.mockRejectedValue(new Error("decode failed"));
    const { enhanceUploadImage } = await import("@/lib/images/enhance-upload");
    const input = Buffer.from("broken");

    const result = await enhanceUploadImage(input, "image/jpeg");

    expect(result).toEqual({
      buffer: input,
      mime: "image/jpeg",
      ext: "jpg",
      enhanced: false,
    });
  });
});
