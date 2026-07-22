import "server-only";

import photoColorBySlug from "@/lib/data/inventory-photo-colors.json";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { revalidatePublicSite } from "@/lib/admin/revalidate";
import { normalizeColorKey } from "@/lib/vehicles/vehicle-colors";

const MARKER_KEY = "inventory_photo_colors_applied_v1";

export type PhotoColorCorrectionResult = {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  checked: number;
  updated: number;
  unchanged: number;
  missing: number;
  errors: Array<{ slug: string; error: string }>;
  examples: Array<{ slug: string; from: string | null; to: string }>;
};

function correctionMap(): Record<string, string> {
  return photoColorBySlug as Record<string, string>;
}

/**
 * One-shot (idempotent) correction of vehicles.color from primary-photo analysis.
 * Marker stored in site_settings so it only runs once per version key.
 */
export async function applyInventoryPhotoColorCorrections(options?: {
  force?: boolean;
}): Promise<PhotoColorCorrectionResult> {
  const supabase = createAdminSupabase();
  if (!supabase) {
    return {
      ok: false,
      skipped: true,
      reason: "Supabase admin client unavailable",
      checked: 0,
      updated: 0,
      unchanged: 0,
      missing: 0,
      errors: [],
      examples: [],
    };
  }

  const map = correctionMap();
  const slugs = Object.keys(map);
  if (!slugs.length) {
    return {
      ok: true,
      skipped: true,
      reason: "No correction map entries",
      checked: 0,
      updated: 0,
      unchanged: 0,
      missing: 0,
      errors: [],
      examples: [],
    };
  }

  if (!options?.force) {
    const { data: marker } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", MARKER_KEY)
      .maybeSingle();
    if (marker?.value) {
      return {
        ok: true,
        skipped: true,
        reason: `Already applied at ${marker.value}`,
        checked: 0,
        updated: 0,
        unchanged: 0,
        missing: 0,
        errors: [],
        examples: [],
      };
    }
  }

  const { data: rows, error } = await supabase
    .from("vehicles")
    .select("id, slug, color")
    .in("slug", slugs);

  if (error) {
    return {
      ok: false,
      skipped: false,
      reason: error.message,
      checked: 0,
      updated: 0,
      unchanged: 0,
      missing: 0,
      errors: [{ slug: "*", error: error.message }],
      examples: [],
    };
  }

  const bySlug = new Map((rows ?? []).map((row) => [row.slug as string, row]));
  let updated = 0;
  let unchanged = 0;
  let missing = 0;
  const errors: Array<{ slug: string; error: string }> = [];
  const examples: Array<{ slug: string; from: string | null; to: string }> = [];

  for (const slug of slugs) {
    const expected = map[slug];
    const row = bySlug.get(slug);
    if (!row) {
      missing += 1;
      continue;
    }
    const current = (row.color as string | null)?.trim() || null;
    if (current && normalizeColorKey(current) === normalizeColorKey(expected)) {
      unchanged += 1;
      continue;
    }

    const { error: updateError } = await supabase
      .from("vehicles")
      .update({ color: expected })
      .eq("id", row.id);

    if (updateError) {
      errors.push({ slug, error: updateError.message });
      continue;
    }

    updated += 1;
    if (examples.length < 12) {
      examples.push({ slug, from: current, to: expected });
    }
  }

  const appliedAt = new Date().toISOString();
  await supabase.from("site_settings").upsert(
    {
      key: MARKER_KEY,
      value: JSON.stringify({
        appliedAt,
        updated,
        unchanged,
        missing,
        errorCount: errors.length,
      }),
    },
    { onConflict: "key" }
  );

  if (updated > 0) {
    revalidatePublicSite();
  }

  return {
    ok: errors.length === 0,
    skipped: false,
    checked: slugs.length,
    updated,
    unchanged,
    missing,
    errors,
    examples,
  };
}
