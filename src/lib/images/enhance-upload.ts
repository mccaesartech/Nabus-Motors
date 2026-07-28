import sharp from "sharp";

/** Conservative clarity defaults — improve soft uploads without crushing faces/text. */
export const UPLOAD_ENHANCE = {
  /** Web gallery hero size; phone 4K was overkill and slowed Sharp. */
  maxDimension: 2560,
  maxOutputBytes: 5 * 1024 * 1024,
  sharpen: { sigma: 0.75, m1: 1.0, m2: 0.45 },
  /** Mild contrast lift (multiplier, offset) — avoid aggressive normalise. */
  contrast: { multiplier: 1.08, offset: -10 },
  modulate: { brightness: 1.02, saturation: 1.04 },
  jpegQuality: 85,
  jpegQualityFallback: 74,
  webpQuality: 84,
  pngCompression: 8,
  /** mozjpeg is slower; default encoder is fine for listing photos. */
  useMozjpeg: false,
} as const;

/**
 * Inventory AI “4K / enhance quality” path — upscale toward UHD listing size
 * with sharpen/contrast. Interpolates existing pixels; does not invent detail.
 */
export const LISTING_ENHANCE_4K = {
  /** Longest side target (~4K UHD width). */
  targetLongestSide: 3840,
  maxOutputBytes: 8 * 1024 * 1024,
  sharpen: { sigma: 1.05, m1: 1.15, m2: 0.55 },
  contrast: { multiplier: 1.1, offset: -12 },
  modulate: { brightness: 1.03, saturation: 1.06 },
  jpegQuality: 90,
  jpegQualityFallback: 78,
  useMozjpeg: false,
} as const;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type EnhanceUploadMode = "full" | "light";

export type EnhanceUploadResult = {
  buffer: Buffer;
  mime: string;
  ext: string;
  enhanced: boolean;
};

export type ListingEnhance4kResult = EnhanceUploadResult & {
  width: number;
  height: number;
  upscaled: boolean;
};

export function isEnhancableImageMime(mime: string): boolean {
  return mime === "image/jpeg" || mime === "image/jpg" || mime === "image/png" || mime === "image/webp";
}

export function mimeToImageExt(mime: string): string {
  return MIME_TO_EXT[mime] ?? "jpg";
}

function fallbackExtForMime(mime: string): string {
  return MIME_TO_EXT[mime] ?? "bin";
}

async function encodePipeline(
  pipeline: ReturnType<typeof sharp>,
  mime: string,
  hasAlpha: boolean
): Promise<{ buffer: Buffer; mime: string; ext: string }> {
  if (hasAlpha && (mime === "image/png" || mime === "image/webp")) {
    const buffer = await pipeline
      .png({ compressionLevel: UPLOAD_ENHANCE.pngCompression })
      .toBuffer();
    return { buffer, mime: "image/png", ext: "png" };
  }

  if (mime === "image/webp") {
    const buffer = await pipeline.webp({ quality: UPLOAD_ENHANCE.webpQuality }).toBuffer();
    return { buffer, mime: "image/webp", ext: "webp" };
  }

  const buffer = await pipeline
    .jpeg({
      quality: UPLOAD_ENHANCE.jpegQuality,
      mozjpeg: UPLOAD_ENHANCE.useMozjpeg,
    })
    .toBuffer();
  return { buffer, mime: "image/jpeg", ext: "jpg" };
}

/**
 * Server-side clarity pass for admin image uploads.
 * Applies EXIF orientation, optional downscale, moderate sharpen + contrast,
 * and sensible encode. On failure returns the original buffer (fail soft).
 *
 * `light` mode (client already resized/compressed): orient + downscale + encode only.
 */
export async function enhanceUploadImage(
  input: Buffer,
  mime: string,
  mode: EnhanceUploadMode = "full"
): Promise<EnhanceUploadResult> {
  const originalExt = fallbackExtForMime(mime);

  if (!isEnhancableImageMime(mime) || input.length === 0) {
    return { buffer: input, mime, ext: originalExt, enhanced: false };
  }

  try {
    const meta = await sharp(input, { failOn: "none" }).metadata();

    let pipeline = sharp(input, { failOn: "none" }).rotate();

    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width > UPLOAD_ENHANCE.maxDimension || height > UPLOAD_ENHANCE.maxDimension) {
      pipeline = pipeline.resize({
        width: UPLOAD_ENHANCE.maxDimension,
        height: UPLOAD_ENHANCE.maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    if (mode === "full") {
      pipeline = pipeline
        .sharpen(UPLOAD_ENHANCE.sharpen)
        .linear(UPLOAD_ENHANCE.contrast.multiplier, UPLOAD_ENHANCE.contrast.offset)
        .modulate(UPLOAD_ENHANCE.modulate);
    }

    const hasAlpha = Boolean(meta.hasAlpha);
    let { buffer: outBuffer, mime: outMime, ext: outExt } = await encodePipeline(
      pipeline,
      mime,
      hasAlpha
    );

    if (outBuffer.length > UPLOAD_ENHANCE.maxOutputBytes) {
      outBuffer = await sharp(outBuffer, { failOn: "none" })
        .jpeg({
          quality: UPLOAD_ENHANCE.jpegQualityFallback,
          mozjpeg: UPLOAD_ENHANCE.useMozjpeg,
        })
        .toBuffer();
      outMime = "image/jpeg";
      outExt = "jpg";

      if (outBuffer.length > UPLOAD_ENHANCE.maxOutputBytes) {
        console.warn(
          "[enhance-upload] Enhanced image still exceeds size cap; storing original."
        );
        return { buffer: input, mime, ext: originalExt, enhanced: false };
      }
    }

    return { buffer: outBuffer, mime: outMime, ext: outExt, enhanced: true };
  } catch (err) {
    console.error("[enhance-upload] Enhancement failed; storing original.", err);
    return { buffer: input, mime, ext: originalExt, enhanced: false };
  }
}

/**
 * Upscale/enhance a listing photo toward ~4K for inventory AI Approve previews.
 * Uses Sharp resize (may enlarge) + sharpen/contrast — not generative upscale.
 */
export async function enhanceListingImageTo4k(
  input: Buffer,
  mime = "image/jpeg"
): Promise<ListingEnhance4kResult> {
  const originalExt = fallbackExtForMime(mime);
  const fail = (buffer: Buffer, m: string, e: string): ListingEnhance4kResult => ({
    buffer,
    mime: m,
    ext: e,
    enhanced: false,
    width: 0,
    height: 0,
    upscaled: false,
  });

  if (input.length === 0) {
    return fail(input, mime, originalExt);
  }

  try {
    const meta = await sharp(input, { failOn: "none" }).metadata();
    const srcW = meta.width ?? 0;
    const srcH = meta.height ?? 0;
    const longest = Math.max(srcW, srcH);
    const target = LISTING_ENHANCE_4K.targetLongestSide;
    const needsResize = longest > 0 && longest !== target;
    const upscaled = longest > 0 && longest < target;

    let pipeline = sharp(input, { failOn: "none" }).rotate();

    if (needsResize) {
      pipeline = pipeline.resize({
        width: target,
        height: target,
        fit: "inside",
        // Allow enlargement for explicit 4K / quality upgrade requests.
        withoutEnlargement: false,
        kernel: sharp.kernel.lanczos3,
      });
    }

    pipeline = pipeline
      .sharpen(LISTING_ENHANCE_4K.sharpen)
      .linear(LISTING_ENHANCE_4K.contrast.multiplier, LISTING_ENHANCE_4K.contrast.offset)
      .modulate(LISTING_ENHANCE_4K.modulate);

    let outBuffer = await pipeline
      .jpeg({
        quality: LISTING_ENHANCE_4K.jpegQuality,
        mozjpeg: LISTING_ENHANCE_4K.useMozjpeg,
      })
      .toBuffer();
    let outMime = "image/jpeg";
    let outExt = "jpg";

    if (outBuffer.length > LISTING_ENHANCE_4K.maxOutputBytes) {
      outBuffer = await sharp(outBuffer, { failOn: "none" })
        .jpeg({
          quality: LISTING_ENHANCE_4K.jpegQualityFallback,
          mozjpeg: LISTING_ENHANCE_4K.useMozjpeg,
        })
        .toBuffer();
    }

    if (outBuffer.length > LISTING_ENHANCE_4K.maxOutputBytes) {
      console.warn(
        "[enhance-upload] 4K enhance still exceeds size cap; storing original."
      );
      return fail(input, mime, originalExt);
    }

    const outMeta = await sharp(outBuffer, { failOn: "none" }).metadata();

    return {
      buffer: outBuffer,
      mime: outMime,
      ext: outExt,
      enhanced: true,
      width: outMeta.width ?? 0,
      height: outMeta.height ?? 0,
      upscaled,
    };
  } catch (err) {
    console.error("[enhance-upload] 4K listing enhance failed; storing original.", err);
    return fail(input, mime, originalExt);
  }
}
