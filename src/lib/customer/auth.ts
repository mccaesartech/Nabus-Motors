import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

export type CustomerProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  registration_id?: string | null;
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

export async function getCustomerFromBearerToken(
  token: string | null | undefined
): Promise<User | null> {
  if (!token) return null;

  const supabase = createServerSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function getCustomerFromAuthHeader(
  authHeader: string | null
): Promise<User | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return getCustomerFromBearerToken(authHeader.slice(7));
}
