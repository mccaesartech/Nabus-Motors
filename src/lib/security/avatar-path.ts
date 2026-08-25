/** Allowed image extensions for customer avatar storage paths. */
export const AVATAR_SAFE_EXTENSIONS = ["jpg", "png", "webp"] as const;

export type AvatarSafeExtension = (typeof AVATAR_SAFE_EXTENSIONS)[number];

/**
 * Build a storage object path under the caller's folder only.
 * Strips path separators / traversal sequences from components so a malformed
 * user id or extension cannot escape `${userId}/`.
 */
export function customerAvatarStoragePath(
  userId: string,
  ext: string
): string {
  const safeId = sanitizePathSegment(userId);
  const safeExt = sanitizeExtension(ext);
  if (!safeId) {
    throw new Error("Invalid avatar user id.");
  }
  if (!safeExt) {
    throw new Error("Invalid avatar extension.");
  }
  return `${safeId}/avatar.${safeExt}`;
}

export function isSafeAvatarStoragePath(path: string, userId: string): boolean {
  const safeId = sanitizePathSegment(userId);
  if (!safeId) return false;
  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) {
    return false;
  }
  return AVATAR_SAFE_EXTENSIONS.some(
    (ext) => path === `${safeId}/avatar.${ext}`
  );
}

function sanitizePathSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "");
}

function sanitizeExtension(ext: string): AvatarSafeExtension | null {
  const cleaned = ext.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalized = cleaned === "jpeg" ? "jpg" : cleaned;
  return (AVATAR_SAFE_EXTENSIONS as readonly string[]).includes(normalized)
    ? (normalized as AvatarSafeExtension)
    : null;
}
