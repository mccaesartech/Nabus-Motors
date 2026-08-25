import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  isJwtIssuedBeforeRevocation,
  parseJwtIssuedAtSeconds,
} from "@/lib/security/jwt-claims";

export type CustomerProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  registration_id?: string | null;
  avatar_url?: string | null;
  address_line?: string | null;
  city?: string | null;
  country?: string | null;
  preferred_contact?: "email" | "phone" | "whatsapp" | null;
  created_at?: string | null;
  email?: string | null;
};

export function customerDisplayName(
  profile: CustomerProfile | null,
  user: User
): string {
  const fromProfile = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fromProfile) return fromProfile;
  const meta = user.user_metadata?.full_name;
  if (typeof meta === "string" && meta.trim()) return meta.trim();
  return user.email?.split("@")[0] ?? "Customer";
}

async function isBearerRevoked(userId: string, token: string): Promise<boolean> {
  const admin = createAdminSupabase();
  if (!admin) return false;

  const iat = parseJwtIssuedAtSeconds(token);
  if (iat == null) return false;

  try {
    const { data, error } = await admin
      .from("profiles")
      .select("credentials_revoked_at")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return false;
    return isJwtIssuedBeforeRevocation(iat, data.credentials_revoked_at);
  } catch {
    return false;
  }
}

export async function getCustomerFromBearerToken(
  token: string | null | undefined
): Promise<User | null> {
  if (!token) return null;

  const supabase = createServerSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  if (await isBearerRevoked(data.user.id, token)) {
    return null;
  }

  return data.user;
}

export async function getCustomerFromAuthHeader(
  authHeader: string | null
): Promise<User | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return getCustomerFromBearerToken(authHeader.slice(7));
}
