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

export function consumeRateLimit(
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

export function resetRateLimitsForTests(): void {
  entries.clear();
}
