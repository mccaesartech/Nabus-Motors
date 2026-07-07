import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CustomerContact = {
  email: string;
  phone: string | null;
  whatsappPreferred: boolean | undefined;
  customerName: string | undefined;
};

/** Resolve email, phone, and WhatsApp preference from a customer user id. */
export async function resolveCustomerContactByUserId(
  supabase: SupabaseClient,
  userId: string
): Promise<CustomerContact> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, email, phone, whatsapp_opt_in")
    .eq("id", userId)
    .maybeSingle();

  let email = profile?.email?.trim() ?? "";
  if (!email) {
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    email = authUser?.user?.email?.trim() ?? "";
  }

  const phone = profile?.phone?.trim() || null;
  const whatsappPreferred =
    profile?.whatsapp_opt_in === null || profile?.whatsapp_opt_in === undefined
      ? undefined
      : profile.whatsapp_opt_in;
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  const customerName = fullName || email.split("@")[0] || undefined;

  return { email, phone, whatsappPreferred, customerName };
}
