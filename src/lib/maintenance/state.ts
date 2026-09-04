import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  shouldBlockRequest,
} from "@/lib/maintenance/rules";

export type MaintenanceState = {
  enabled: boolean;
  message: string;
};

const CACHE_TTL_MS = 15_000;

type CacheEntry = {
  at: number;
  state: MaintenanceState;
};

let memoryCache: CacheEntry | null = null;

/** Clear the short-lived in-process cache (call after admin toggle). */
export function invalidateMaintenanceCache(): void {
  memoryCache = null;
}

function parseEnabled(value: string | undefined): boolean {
  if (!value) return false;
  return value === "true" || value === "1";
}

function softFailState(): MaintenanceState {
  return { enabled: false, message: DEFAULT_MAINTENANCE_MESSAGE };
}

/**
 * Edge-safe maintenance flag reader with a brief in-memory TTL.
 * Soft-fails to disabled if Supabase/env/keys are unavailable (safe during rollout).
 */
export async function getMaintenanceState(): Promise<MaintenanceState> {
  const now = Date.now();
  if (memoryCache && now - memoryCache.at < CACHE_TTL_MS) {
    return memoryCache.state;
  }

  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  if (!url || !anon) {
    const state = softFailState();
    memoryCache = { at: now, state };
    return state;
  }

  try {
    const query = new URLSearchParams({
      select: "key,value",
      key: "in.(maintenance_mode,maintenance_message)",
    });
    const res = await fetch(`${url}/rest/v1/site_settings?${query.toString()}`, {
      method: "GET",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        Accept: "application/json",
      },
      // Proxy/edge: avoid Next fetch cache semantics; we own the TTL.
      cache: "no-store",
    });

    if (!res.ok) {
      const state = softFailState();
      memoryCache = { at: now, state };
      return state;
    }

    const rows = (await res.json()) as { key?: string; value?: string }[];
    const map: Record<string, string> = {};
    for (const row of rows ?? []) {
      if (row?.key && typeof row.value === "string") {
        map[row.key] = row.value;
      }
    }

    const state: MaintenanceState = {
      enabled: parseEnabled(map.maintenance_mode),
      message: (map.maintenance_message || "").trim() || DEFAULT_MAINTENANCE_MESSAGE,
    };
    memoryCache = { at: now, state };
    return state;
  } catch {
    const state = softFailState();
    memoryCache = { at: now, state };
    return state;
  }
}

export function maintenanceApiPayload(message: string) {
  const errorId = `TG-M-${Date.now().toString(36).toUpperCase()}`;
  return {
    ok: false as const,
    message:
      message.trim() ||
      "Nabus Motors is temporarily unavailable for scheduled maintenance. Please try again shortly.",
    code: "maintenance" as const,
    errorId,
  };
}

export { shouldBlockRequest, CACHE_TTL_MS };
