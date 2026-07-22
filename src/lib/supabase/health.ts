import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";

export type DbHealthStatus = {
  configured: boolean;
  urlPresent: boolean;
  anonKeyPresent: boolean;
  serviceRolePresent: boolean;
  connected: boolean;
  latencyMs: number | null;
  tables: Record<string, boolean>;
  error: string | null;
};

const PROBE_TABLES = [
  "site_content",
  "site_settings",
  "vehicles",
  "parts",
  "parts_categories",
  "freight_quote_requests",
  "shipment_tracking",
  "preorder_inquiries",
] as const;

export async function checkDbHealth(): Promise<DbHealthStatus> {
  const urlPresent = Boolean(getSupabaseUrl());
  const anonKeyPresent = Boolean(getSupabaseAnonKey());
  const serviceRolePresent = Boolean(getSupabaseServiceRoleKey());
  const configured = urlPresent && anonKeyPresent;

  const base: DbHealthStatus = {
    configured,
    urlPresent,
    anonKeyPresent,
    serviceRolePresent,
    connected: false,
    latencyMs: null,
    tables: Object.fromEntries(PROBE_TABLES.map((t) => [t, false])),
    error: null,
  };

  if (!configured) {
    return {
      ...base,
      error: serviceRolePresent
        ? "Supabase URL or anon key missing."
        : "Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return {
      ...base,
      error: "Service role client unavailable — set SUPABASE_SERVICE_ROLE_KEY for admin/CMS reads.",
    };
  }

  const started = Date.now();
  const tables: Record<string, boolean> = { ...base.tables };
  let firstError: string | null = null;

  for (const table of PROBE_TABLES) {
    const { error } = await supabase.from(table).select("*", { head: true, count: "exact" }).limit(1);
    if (error) {
      if (!firstError) firstError = `${table}: ${error.message}`;
      tables[table] = false;
    } else {
      tables[table] = true;
    }
  }

  const reachableCount = Object.values(tables).filter(Boolean).length;
  const criticalOk =
    tables.vehicles === true &&
    tables.site_content === true &&
    tables.site_settings === true;
  const missing = PROBE_TABLES.filter((t) => !tables[t]);

  return {
    ...base,
    connected: reachableCount > 0,
    latencyMs: Date.now() - started,
    tables,
    error:
      reachableCount === 0
        ? (firstError ?? "Could not reach any backend tables.")
        : !criticalOk
          ? `Core tables unavailable (${missing.join(", ")}). ${firstError ?? ""}`.trim()
          : missing.length > 0
            ? `Optional tables unavailable: ${missing.join(", ")}. Some modules may be limited.`
            : null,
  };
}
