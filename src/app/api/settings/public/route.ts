import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { DEFAULT_SITE_SETTINGS } from "@/lib/platform/modules";

const PUBLIC_KEYS = [
  "clearing_fee_notice",
  "preorder_terms_a",
  "preorder_terms_b",
  "preorder_terms_c",
  "maintenance_mode",
  "maintenance_message",
  "freight_default_origins",
  "freight_cargo_options",
  "appointment_branches",
] as const;

export async function GET() {
  const defaults: Record<string, string> = {};
  for (const key of PUBLIC_KEYS) {
    defaults[key] = DEFAULT_SITE_SETTINGS[key] ?? "";
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, settings: defaults, configured: false });
  }

  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", [...PUBLIC_KEYS]);

  if (error) {
    console.error("site_settings public fetch failed:", error.message);
    return NextResponse.json({ ok: true, configured: true, settings: defaults });
  }

  const settings = { ...defaults };
  for (const row of data ?? []) {
    if (row.key && typeof row.value === "string") {
      settings[row.key] = row.value;
    }
  }

  return NextResponse.json({ ok: true, configured: true, settings });
}
