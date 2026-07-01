/** Trim and validate Supabase env vars (common copy/paste mistakes). */
export function getSupabaseUrl(): string | null {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)?.trim();
  if (!raw) return null;

  // Reject dashboard links or placeholder text
  if (
    raw.includes("supabase.com/dashboard") ||
    raw.includes("your Project URL") ||
    !raw.startsWith("https://")
  ) {
    return null;
  }

  // Must be https://xxxx.supabase.co (no trailing path)
  try {
    const parsed = new URL(raw);
    if (!parsed.hostname.endsWith(".supabase.co")) return null;
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return null;
  }
}

export function getSupabaseAnonKey(): string | null {
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  )?.trim();
  if (!key || key.includes("anon key") || key.length < 20) return null;
  return key;
}

export function getSupabaseServiceRoleKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key || key.includes("service role") || key.length < 20) return null;
  return key;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}
