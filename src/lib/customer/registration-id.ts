import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ensure a profiles row has a unique TG-YYYY-##### registration_id.
 * Prefers the atomic DB RPC; falls back to generate_registration_id + update.
 */
export async function ensureProfileRegistrationId(
  admin: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: viaRpc, error: rpcError } = await admin.rpc(
    "ensure_customer_registration_id",
    { p_user_id: userId }
  );

  if (!rpcError && typeof viaRpc === "string" && viaRpc.trim()) {
    return viaRpc.trim();
  }

  if (rpcError) {
    console.warn(
      "[registration-id] ensure_customer_registration_id RPC unavailable:",
      rpcError.message
    );
  }

  const { data: existing } = await admin
    .from("profiles")
    .select("registration_id")
    .eq("id", userId)
    .maybeSingle();

  if (existing?.registration_id?.trim()) {
    return existing.registration_id.trim();
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: regId, error: genError } = await admin.rpc(
      "generate_registration_id"
    );
    if (genError || typeof regId !== "string" || !regId.trim()) {
      console.warn(
        "[registration-id] generate_registration_id failed:",
        genError?.message
      );
      return null;
    }

    const { data: updated, error: updateError } = await admin
      .from("profiles")
      .update({
        registration_id: regId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .is("registration_id", null)
      .select("registration_id")
      .maybeSingle();

    if (!updateError && updated?.registration_id) {
      return updated.registration_id;
    }

    // Race: another writer filled it, or unique collision — re-read.
    const { data: again } = await admin
      .from("profiles")
      .select("registration_id")
      .eq("id", userId)
      .maybeSingle();
    if (again?.registration_id?.trim()) {
      return again.registration_id.trim();
    }
  }

  return null;
}
