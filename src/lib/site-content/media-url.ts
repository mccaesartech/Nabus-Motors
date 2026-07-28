import { categoryPhotoUrlFor, isValidImageUrl } from "@/lib/data/vehicle-images";

/** True when the URL is a public Supabase Storage object (already CDN-served). */
export function isSupabaseStoragePublicUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || !trimmed.includes("/storage/v1/object/public/")) return false;

  if (trimmed.startsWith("/storage/v1/")) return true;

  try {
    return new URL(trimmed).hostname.toLowerCase().endsWith(".supabase.co");
  } catch {
    return false;
  }
}

/** Turn relative Supabase storage paths into absolute public URLs. */
export function normalizeMediaUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");

  if (trimmed.startsWith("/storage/v1/")) {
    return supabaseBase ? `${supabaseBase}${trimmed}` : trimmed;
  }

  if (
    supabaseBase &&
    !trimmed.startsWith("http") &&
    !trimmed.startsWith("/") &&
    trimmed.includes("vehicle-images/")
  ) {
    return `${supabaseBase}/storage/v1/object/public/${trimmed.replace(/^\//, "")}`;
  }

  return trimmed;
}

/**
 * Derive avatar initials from a display name.
 * - Multi-part: first letter of first + last word ("Ama Mensah" → "AM")
 * - Single word: up to two letters ("Grace" → "GR")
 * - Empty / whitespace: "?"
 */
export function getNameInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);

  if (parts.length === 0) return "?";

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  const first = parts[0][0] ?? "";
  const last = parts[parts.length - 1][0] ?? "";
  return `${first}${last}`.toUpperCase();
}

/** Build a ui-avatars placeholder whose letters match the displayed name. */
export function buildTestimonialAvatarUrl(name: string, index = 0): string {
  const trimmed = name.trim();
  const label = trimmed || `Client ${index + 1}`;
  const params = new URLSearchParams({
    name: label,
    background: "111827",
    color: "f9fafb",
    size: "128",
  });
  return `https://ui-avatars.com/api/?${params.toString()}`;
}

export function resolveTestimonialImage(
  image: string,
  index: number,
  name = ""
): string {
  const normalized = normalizeMediaUrl(image);
  if (isValidImageUrl(normalized)) return normalized;
  return buildTestimonialAvatarUrl(name, index);
}

/** Custom uploaded category image always wins over stock pool photos. */
export function resolveCategoryImage(
  categoryId: string,
  slug: string,
  image?: string | null
): string {
  const trimmed = (image ?? "").trim();
  if (!trimmed) return categoryPhotoUrlFor(categoryId, slug);

  const normalized = normalizeMediaUrl(trimmed);
  if (isValidImageUrl(normalized)) return normalized;

  // Preserve explicit admin URLs even when normalization/validation is edge-casey.
  if (isValidImageUrl(trimmed)) return normalizeMediaUrl(trimmed) || trimmed;

  return categoryPhotoUrlFor(categoryId, slug);
}
