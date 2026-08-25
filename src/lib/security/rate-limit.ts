import { createAdminSupabase } from "@/lib/supabase/admin";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  limit: number;
  windowMs: number;
  now?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

const entries = new Map<string, RateLimitEntry>();

export function requestIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip")?.trim() || "unknown";
}

function memoryResult(
  namespace: string,
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = options.now ?? Date.now();
  const key = `${namespace}:${identifier}`;
  const existing = entries.get(key);
  const entry =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + options.windowMs };

  entry.count += 1;
  entries.set(key, entry);

  if (entries.size > 10_000) {
    for (const [storedKey, stored] of entries) {
      if (stored.resetAt <= now) entries.delete(storedKey);
    }
  }

  return {
    allowed: entry.count <= options.limit,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    remaining: Math.max(0, options.limit - entry.count),
  };
}

/**
 * In-process rate limit (sync). Prefer `consumeRateLimitDurable` on auth endpoints
 * so counters survive across serverless instances when the DB table is present.
 */
export function consumeRateLimit(
  namespace: string,
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  return memoryResult(namespace, identifier, options);
}

/**
 * Shared rate limit backed by `platform_rate_limits` when available, with
 * in-memory fallback for local/dev or missing migration.
 */
export async function consumeRateLimitDurable(
  namespace: string,
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const now = options.now ?? Date.now();
  const key = `${namespace}:${identifier}`.slice(0, 240);
  const resetAtIso = new Date(now + options.windowMs).toISOString();

  const supabase = createAdminSupabase();
  if (!supabase) {
    return memoryResult(namespace, identifier, options);
  }

  try {
    const { data: existing } = await supabase
      .from("platform_rate_limits")
      .select("key, count, reset_at")
      .eq("key", key)
      .maybeSingle();

    const resetAtMs = existing?.reset_at ? Date.parse(String(existing.reset_at)) : NaN;
    const windowOpen = Number.isFinite(resetAtMs) && resetAtMs > now;
    const nextCount = windowOpen ? Number(existing?.count ?? 0) + 1 : 1;
    const nextResetAt = windowOpen ? String(existing?.reset_at) : resetAtIso;

    const { error } = await supabase.from("platform_rate_limits").upsert(
      {
        key,
        count: nextCount,
        reset_at: nextResetAt,
        updated_at: new Date(now).toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) {
      return memoryResult(namespace, identifier, options);
    }

    return {
      allowed: nextCount <= options.limit,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil(((windowOpen ? resetAtMs : now + options.windowMs) - now) / 1000)
      ),
      remaining: Math.max(0, options.limit - nextCount),
    };
  } catch {
    return memoryResult(namespace, identifier, options);
  }
}

export function resetRateLimitsForTests(): void {
  entries.clear();
}
