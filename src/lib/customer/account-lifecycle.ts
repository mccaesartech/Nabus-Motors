import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { notifyCustomer } from "@/lib/notifications/customer-notify";
import type { AccountStatus } from "@/lib/customer/account-lifecycle.shared";

export {
  ACCOUNT_STATUSES,
  DELETION_REASONS,
  DELETION_REASON_LABELS,
  type AccountStatus,
  type DeletionReason,
} from "@/lib/customer/account-lifecycle.shared";

export type AccountLifecycleProfile = {
  account_status: AccountStatus;
  deletion_requested_at: string | null;
  scheduled_deletion_at: string | null;
  retention_expires_at: string | null;
  deletion_reason: string | null;
  deletion_feedback: Record<string, unknown> | null;
};

export function getAccountRetentionDays(): number {
  const raw = process.env.ACCOUNT_DELETION_RETENTION_DAYS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 30;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

export function getDeletionRateLimitMax(): number {
  const raw = process.env.ACCOUNT_DELETION_RATE_LIMIT?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 5;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

export { isValidDeletionReason } from "@/lib/customer/account-lifecycle.validation";

export function parseClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}

export async function verifyCustomerReauth(params: {
  email: string;
  password?: string;
  verificationToken?: string;
  allowBanned?: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = createAdminSupabase();
  const email = params.email.trim().toLowerCase();

  if (params.allowBanned && admin && params.password?.trim()) {
    const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authUser = users?.users?.find((u) => u.email?.toLowerCase() === email);
    if (authUser) {
      try {
        await admin.auth.admin.updateUserById(authUser.id, { ban_duration: "none" });
      } catch {
        // continue
      }
    }
  }

  const supabase = createServerSupabase();
  if (!supabase) {
    return { ok: false, message: "Authentication is not configured." };
  }

  if (params.password?.trim()) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: params.password,
    });
    if (error) {
      if (params.allowBanned && admin) {
        const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const authUser = users?.users?.find((u) => u.email?.toLowerCase() === email);
        if (authUser) {
          try {
            await admin.auth.admin.updateUserById(authUser.id, { ban_duration: "876000h" });
          } catch {
            // ignore
          }
        }
      }
      return { ok: false, message: "Incorrect password. Please try again." };
    }
    return { ok: true };
  }

  if (params.verificationToken?.trim()) {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: params.verificationToken.trim(),
      type: "email",
    });
    if (error) {
      return { ok: false, message: "Invalid or expired verification code." };
    }
    return { ok: true };
  }

  return {
    ok: false,
    message: "Re-authentication required. Provide your password or verification code.",
  };
}

export async function checkDeletionRateLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<{ allowed: true } | { allowed: false; message: string }> {
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("account_deletion_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("attempted_at", windowStart);

  if (error) {
    console.warn("[account-lifecycle] rate limit check failed:", error.message);
    return { allowed: true };
  }

  if ((count ?? 0) >= getDeletionRateLimitMax()) {
    return {
      allowed: false,
      message: "Too many deletion attempts. Please try again in an hour.",
    };
  }

  return { allowed: true };
}

export async function recordDeletionAttempt(
  supabase: SupabaseClient,
  userId: string,
  ipAddress: string | null,
  success: boolean
): Promise<void> {
  await supabase.from("account_deletion_attempts").insert({
    user_id: userId,
    ip_address: ipAddress,
    success,
  });
}

export async function terminateCustomerSessions(userId: string): Promise<void> {
  const admin = createAdminSupabase();
  if (!admin) return;

  try {
    await admin.auth.admin.signOut(userId, "global");
  } catch (err) {
    console.warn("[account-lifecycle] global signOut failed:", err);
  }

  try {
    await admin.auth.admin.updateUserById(userId, {
      ban_duration: "876000h",
    });
  } catch (err) {
    console.warn("[account-lifecycle] ban user failed:", err);
  }
}

export async function restoreCustomerLogin(userId: string): Promise<void> {
  const admin = createAdminSupabase();
  if (!admin) return;

  try {
    await admin.auth.admin.updateUserById(userId, {
      ban_duration: "none",
    });
  } catch (err) {
    console.warn("[account-lifecycle] unban user failed:", err);
  }
}

export function isMissingAuthUserError(message: string): boolean {
  return /not found|user not found/i.test(message);
}

export async function deleteAuthUserAfterAnonymization(userId: string): Promise<boolean> {
  const admin = createAdminSupabase();
  if (!admin) return false;

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error && !isMissingAuthUserError(error.message)) {
    console.warn("[account-lifecycle] auth delete failed; user and provider detail omitted");
    return false;
  }
  return true;
}

export type RequestDeletionParams = {
  userId: string;
  email: string;
  phone?: string | null;
  customerName?: string;
  reason?: string | null;
  feedback?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

export async function requestCustomerAccountDeletion(
  params: RequestDeletionParams
): Promise<
  | { ok: true; retentionExpiresAt: string; scheduledDeletionAt: string }
  | { ok: false; message: string }
> {
  const supabase = createAdminSupabase();
  if (!supabase) {
    return { ok: false, message: "Account deletion is not available right now." };
  }

  const { data, error } = await supabase.rpc("request_account_deletion", {
    p_user_id: params.userId,
    p_reason: params.reason ?? null,
    p_feedback: params.feedback ?? null,
    p_retention_days: getAccountRetentionDays(),
    p_ip_address: params.ipAddress ?? null,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const retentionExpiresAt = row?.retention_expires_at as string | undefined;
  const scheduledDeletionAt = row?.scheduled_deletion_at as string | undefined;

  if (!retentionExpiresAt || !scheduledDeletionAt) {
    return { ok: false, message: "Could not schedule account deletion." };
  }

  await terminateCustomerSessions(params.userId);

  const expiryLabel = new Date(retentionExpiresAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  await notifyCustomer({
    email: params.email,
    phone: params.phone,
    customerName: params.customerName,
    template: "account_deletion_scheduled",
    data: {
      retentionDays: String(getAccountRetentionDays()),
      scheduledDeletionDate: expiryLabel,
      restoreUrl: `${process.env.NEXT_PUBLIC_AUTO_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ""}/account/restore-deletion`,
    },
    sourceTable: "profiles",
    sourceId: params.userId,
    emailRequired: true,
  });

  return { ok: true, retentionExpiresAt, scheduledDeletionAt };
}

export async function cancelCustomerAccountDeletion(params: {
  userId: string;
  ipAddress?: string | null;
  administratorId?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = createAdminSupabase();
  if (!supabase) {
    return { ok: false, message: "Account restoration is not available right now." };
  }

  const { error } = await supabase.rpc("cancel_account_deletion", {
    p_user_id: params.userId,
    p_ip_address: params.ipAddress ?? null,
    p_administrator_id: params.administratorId ?? null,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  await restoreCustomerLogin(params.userId);
  return { ok: true };
}

export async function processExpiredAccountDeletions(): Promise<number> {
  const supabase = createAdminSupabase();
  if (!supabase) return 0;

  const { data, error } = await supabase.rpc("process_expired_deletions");
  if (error) {
    console.error("[account-lifecycle] process_expired_deletions failed:", error.message);
    return 0;
  }

  const count = typeof data === "number" ? data : 0;

  // Always retry archived users. If a previous run anonymized the profile but
  // failed between the RPC and Auth deletion, limiting cleanup to newly
  // processed rows would leave the Auth identity and cascade-owned data behind.
  const { data: archived, error: archivedError } = await supabase
    .from("profiles")
    .select("id")
    .eq("account_status", "archived")
    .order("anonymized_at", { ascending: true })
    .limit(200);

  if (archivedError) {
    console.error("[account-lifecycle] archived auth cleanup query failed; provider detail omitted");
    return count;
  }

  for (const row of archived ?? []) {
    await deleteAuthUserAfterAnonymization(row.id);
  }

  return count;
}

export async function getAccountLifecycleProfile(
  userId: string
): Promise<AccountLifecycleProfile | null> {
  const supabase = createAdminSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("profiles")
    .select(
      "account_status, deletion_requested_at, scheduled_deletion_at, retention_expires_at, deletion_reason, deletion_feedback"
    )
    .eq("id", userId)
    .maybeSingle();

  return (data as AccountLifecycleProfile | null) ?? null;
}

export async function logAdminViewedDeletionRequest(
  userId: string,
  administratorId: string,
  ipAddress: string | null
): Promise<void> {
  const supabase = createAdminSupabase();
  if (!supabase) return;

  await supabase.rpc("log_account_lifecycle_event", {
    p_action: "admin_viewed_deletion_request",
    p_user_id: userId,
    p_administrator_id: administratorId,
    p_ip_address: ipAddress,
    p_metadata: {},
  });
}
