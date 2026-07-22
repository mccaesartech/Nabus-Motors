const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;
const recentByIp = new Map<string, number[]>();

export function isPasskeyRateLimited(ip: string): boolean {
  const now = Date.now();
  const times = (recentByIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= MAX_ATTEMPTS) return true;
  times.push(now);
  recentByIp.set(ip, times);
  return false;
}

export function passkeyRateLimitMessage(): string {
  return "Too many passkey attempts. Please wait a minute and try again.";
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}
