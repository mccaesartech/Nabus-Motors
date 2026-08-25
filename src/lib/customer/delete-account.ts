import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requestCustomerAccountDeletion,
  type RequestDeletionParams,
} from "@/lib/customer/account-lifecycle";
import { isValidDeleteConfirmation } from "@/lib/customer/account-lifecycle.validation";

export { isValidDeleteConfirmation };

/** @deprecated Use requestCustomerAccountDeletion for the lifecycle soft-delete flow. */
export async function deleteCustomerAccount(
  supabase: SupabaseClient,
  userId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error: dataError } = await supabase.rpc("delete_customer_account_data", {
    p_user_id: userId,
  });

  if (dataError) {
    return { ok: false, message: dataError.message };
  }

  return { ok: true };
}

export type InitiateAccountDeletionParams = RequestDeletionParams & {
  supabase: SupabaseClient;
};

export async function initiateAccountDeletion(
  params: InitiateAccountDeletionParams
): Promise<
  | { ok: true; retentionExpiresAt: string; scheduledDeletionAt: string }
  | { ok: false; message: string }
> {
  return requestCustomerAccountDeletion(params);
}
