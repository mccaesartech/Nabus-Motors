import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { DEFAULT_SITE_SETTINGS } from "@/lib/platform/modules";
import {
  mergeSiteSettings,
  toOperationalSettings,
  type OperationalSettings,
  type SiteSettings,
} from "@/lib/platform/site-settings";

/** Time-based revalidation for operational settings (seconds). */
export const SITE_SETTINGS_REVALIDATE_SECONDS = 120;
export const SITE_SETTINGS_CACHE_TAG = "site-settings";

async function fetchSiteSettingsFromDb(): Promise<OperationalSettings> {
  const supabase = createAdminSupabase();
  if (!supabase) {
    return toOperationalSettings(DEFAULT_SITE_SETTINGS as SiteSettings);
  }

  const { data, error } = await supabase.from("site_settings").select("key, value");
  if (error) {
    console.error("site_settings fetch failed:", error.message);
    return toOperationalSettings(DEFAULT_SITE_SETTINGS as SiteSettings);
  }

  return toOperationalSettings(mergeSiteSettings(data));
}

const getCachedSiteSettings = unstable_cache(
  fetchSiteSettingsFromDb,
  ["site-settings-v1"],
  {
    revalidate: SITE_SETTINGS_REVALIDATE_SECONDS,
    tags: [SITE_SETTINGS_CACHE_TAG],
  }
);

/** Operational settings — cached 120s (used by public shell on every page). */
export const getSiteSettings = cache(getCachedSiteSettings);

/** Bust cached public settings after admin saves (including maintenance toggle). */
export function revalidateSiteSettings() {
  revalidateTag(SITE_SETTINGS_CACHE_TAG, "max");
}
