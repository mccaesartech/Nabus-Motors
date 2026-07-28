/** Hostnames valid for Supabase project URL (default or Custom Domain for Auth). */
function isAllowedSupabaseProjectHost(hostname: string): boolean {
  if (hostname.endsWith(".supabase.co")) return true;
  if (hostname.endsWith(".supabase.com") || hostname === "supabase.co") {
    return false;
  }
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
    return false;
  }
  // Custom Domain (Pro+): e.g. auth.truegoshen.com — see docs/GOOGLE_AUTH.md
  return hostname.includes(".");
}

/** Trim and validate Supabase env vars (common copy/paste mistakes). */
export function getSupabaseUrl(): string | null {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)?.trim();
  if (!raw) return null;

  // Reject dashboard links or placeholder text
  if (
    raw.includes("supabase.com/dashboard") ||
    raw.includes("your Project URL") ||
    raw.includes("your_supabase_project_url") ||
    !raw.startsWith("https://")
  ) {
    return null;
  }

  // https://xxxx.supabase.co or https://auth.yourdomain.com (no trailing path)
  try {
    const parsed = new URL(raw);
    if (parsed.pathname !== "/" && parsed.pathname !== "") return null;
    if (!isAllowedSupabaseProjectHost(parsed.hostname)) return null;
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return null;
  }
}

export function getSupabaseAnonKey(): string | null {
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  )?.trim();
  if (
    !key ||
    key.includes("anon key") ||
    key.includes("your_supabase_anon_key") ||
    key.length < 20
  ) {
    return null;
  }
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
