/**
 * Browser-side resize/compress before vehicle image upload.
 * Cuts upload bytes and server Sharp work so photos land in storage faster.
 */

export const CLIENT_UPLOAD = {
  /** Longest edge after resize — enough for hero/gallery, not phone-native 4K. */
  maxDimension: 2400,
  /** Skip re-encode when already small enough. */
  skipBelowBytes: 900 * 1024,
  /** Target JPEG quality for canvas export. */
  quality: 0.82,
  /** Prefer JPEG for uploads (smaller + consistent MIME for storage). */
  outputMime: "image/jpeg" as const,
  outputExt: "jpg" as const,
} as const;

function renameToJpeg(name: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "photo";
  return `${base}.${CLIENT_UPLOAD.outputExt}`;
}

/**
 * Downscale and JPEG-compress large phone photos in the browser.
 * Returns the original file when compression is unavailable or would not help.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;
  if (typeof createImageBitmap !== "function") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const width = bitmap.width;
    const height = bitmap.height;
    const longest = Math.max(width, height);

    const needsResize = longest > CLIENT_UPLOAD.maxDimension;
    const needsCompress =
      file.size > CLIENT_UPLOAD.skipBelowBytes ||
      file.type === "image/png" ||
      needsResize;

    if (!needsCompress) {
      bitmap.close();
      return file;
    }

    const scale = needsResize ? CLIENT_UPLOAD.maxDimension / longest : 1;
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, CLIENT_UPLOAD.outputMime, CLIENT_UPLOAD.quality);
    });

    if (!blob || blob.size === 0) return file;
    // Keep original when re-encode somehow got larger (rare for PNG→JPEG).
    if (blob.size >= file.size && !needsResize && file.type !== "image/png") {
      return file;
    }

    return new File([blob], renameToJpeg(file.name), {
      type: CLIENT_UPLOAD.outputMime,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

/** Run async work over items with a fixed concurrency cap. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()));
  return results;
}
