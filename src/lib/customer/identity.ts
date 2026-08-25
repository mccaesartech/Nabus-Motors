import type { ExternalAuthUser } from "@/lib/customer/external-auth";

export type CustomerProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  registration_id?: string | null;
};

export function customerDisplayName(
  profile: CustomerProfile | null,
  user: ExternalAuthUser
): string {
  const fromProfile = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fromProfile) return fromProfile;
  const meta = user.user_metadata?.full_name;
  if (typeof meta === "string" && meta.trim()) return meta.trim();
  if (user.name?.trim()) return user.name.trim();
  return user.email?.split("@")[0] ?? "Customer";
}
