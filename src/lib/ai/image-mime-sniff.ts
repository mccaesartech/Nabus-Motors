import { mediaBytesMatchMime } from "@/lib/security/media-signature";

const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

/** Infer image MIME from magic bytes when CDNs return octet-stream / empty type. */
export function sniffImageMimeFromBytes(bytes: Uint8Array): string | null {
  if (mediaBytesMatchMime(bytes, "image/jpeg")) return "image/jpeg";
  if (mediaBytesMatchMime(bytes, "image/png")) return "image/png";
  if (mediaBytesMatchMime(bytes, "image/webp")) return "image/webp";
  return null;
}

export function mimeFromUrlExtension(url: string): string | null {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
    if (path.endsWith(".png")) return "image/png";
    if (path.endsWith(".webp")) return "image/webp";
  } catch {
    /* ignore */
  }
  return null;
}

/** Resolve a Gemini-safe MIME using header, magic bytes, then URL extension. */
export function resolveInlineImageMime(
  headerMime: string | null | undefined,
  bytes: Uint8Array,
  url: string
): string | null {
  const header = headerMime?.split(";")[0]?.trim().toLowerCase() || null;
  if (header && ALLOWED_MIME.has(header)) {
    const normalized = header === "image/jpg" ? "image/jpeg" : header;
    if (mediaBytesMatchMime(bytes, normalized)) return normalized;
  }
  const sniffed = sniffImageMimeFromBytes(bytes);
  if (sniffed) return sniffed;
  const fromExt = mimeFromUrlExtension(url);
  if (fromExt && mediaBytesMatchMime(bytes, fromExt)) return fromExt;
  return null;
}
