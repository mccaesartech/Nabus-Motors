import { categoryPhotoUrlFor, isValidImageUrl } from "@/lib/data/vehicle-images";

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

const DEFAULT_TESTIMONIAL_AVATARS = [
  "https://ui-avatars.com/api/?name=Kwame+Asante&background=111827&color=f9fafb&size=128",
  "https://ui-avatars.com/api/?name=Ama+Osei&background=111827&color=f9fafb&size=128",
  "https://ui-avatars.com/api/?name=David+Martinez&background=111827&color=f9fafb&size=128",
  "https://ui-avatars.com/api/?name=Jennifer+Mensah&background=111827&color=f9fafb&size=128",
];

export function resolveTestimonialImage(image: string, index: number): string {
  const normalized = normalizeMediaUrl(image);
  if (isValidImageUrl(normalized)) return normalized;
  return DEFAULT_TESTIMONIAL_AVATARS[index % DEFAULT_TESTIMONIAL_AVATARS.length];
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
