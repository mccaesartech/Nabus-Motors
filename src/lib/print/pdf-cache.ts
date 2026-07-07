type PdfCacheEntry = {
  blob: Blob;
  createdAt: number;
};

const memoryCache = new Map<string, PdfCacheEntry>();
const inflight = new Map<string, Promise<Blob>>();

/** Fast string hash for in-memory PDF cache keys. */
export function hashDocumentHtml(html: string): string {
  let hash = 5381;
  for (let i = 0; i < html.length; i++) {
    hash = ((hash << 5) + hash) ^ html.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function getCachedPdfBlob(html: string): Blob | null {
  return memoryCache.get(hashDocumentHtml(html))?.blob ?? null;
}

export function isPdfGenerationInFlight(html: string): boolean {
  return inflight.has(hashDocumentHtml(html));
}

export async function getOrGeneratePdfBlob(
  html: string,
  generate: () => Promise<Blob>
): Promise<Blob> {
  const key = hashDocumentHtml(html);
  const cached = memoryCache.get(key);
  if (cached) return cached.blob;

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = generate()
    .then((blob) => {
      memoryCache.set(key, { blob, createdAt: Date.now() });
      inflight.delete(key);
      return blob;
    })
    .catch((error) => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, promise);
  return promise;
}

/** Start PDF generation in the background; no-op if cached or already running. */
export function prewarmPdfBlob(html: string, generate: () => Promise<Blob>): void {
  const key = hashDocumentHtml(html);
  if (memoryCache.has(key) || inflight.has(key)) return;
  void getOrGeneratePdfBlob(html, generate);
}
