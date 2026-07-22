import sharp from "sharp";

/** Conservative clarity defaults — improve soft uploads without crushing faces/text. */
export const UPLOAD_ENHANCE = {
  maxDimension: 4096,
  maxOutputBytes: 5 * 1024 * 1024,
  sharpen: { sigma: 0.75, m1: 1.0, m2: 0.45 },
  /** Mild contrast lift (multiplier, offset) — avoid aggressive normalise. */
  contrast: { multiplier: 1.08, offset: -10 },
  modulate: { brightness: 1.02, saturation: 1.04 },
  jpegQuality: 88,
  jpegQualityFallback: 76,
  webpQuality: 86,
  pngCompression: 8,
} as const;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type EnhanceUploadResult = {
  buffer: Buffer;
  mime: string;
  ext: string;
  enhanced: boolean;
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

/**
 * Server-side clarity pass for admin image uploads.
 * Applies EXIF orientation, optional downscale, moderate sharpen + contrast,
 * and sensible encode. On failure returns the original buffer (fail soft).
 */
export async function enhanceUploadImage(
  input: Buffer,
  mime: string
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

    pipeline = pipeline
      .sharpen(UPLOAD_ENHANCE.sharpen)
      .linear(UPLOAD_ENHANCE.contrast.multiplier, UPLOAD_ENHANCE.contrast.offset)
      .modulate(UPLOAD_ENHANCE.modulate);

    const hasAlpha = Boolean(meta.hasAlpha);
    let outBuffer: Buffer;
    let outMime: string;
    let outExt: string;

    if (hasAlpha && (mime === "image/png" || mime === "image/webp")) {
      outBuffer = await pipeline
        .png({ compressionLevel: UPLOAD_ENHANCE.pngCompression })
        .toBuffer();
      outMime = "image/png";
      outExt = "png";
    } else if (mime === "image/webp") {
      outBuffer = await pipeline.webp({ quality: UPLOAD_ENHANCE.webpQuality }).toBuffer();
      outMime = "image/webp";
      outExt = "webp";
    } else {
      outBuffer = await pipeline
        .jpeg({ quality: UPLOAD_ENHANCE.jpegQuality, mozjpeg: true })
        .toBuffer();
      outMime = "image/jpeg";
      outExt = "jpg";
    }

    if (outBuffer.length > UPLOAD_ENHANCE.maxOutputBytes) {
      outBuffer = await sharp(outBuffer, { failOn: "none" })
        .jpeg({ quality: UPLOAD_ENHANCE.jpegQualityFallback, mozjpeg: true })
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
