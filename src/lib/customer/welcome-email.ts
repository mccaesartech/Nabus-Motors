import "server-only";

import { SITE_EMAIL, SITE_PHONE_DISPLAY } from "@/lib/constants";
import { welcomeEmail } from "@/lib/email/branded-templates";
import { sendEmail } from "@/lib/email/resend";
import { logAppError } from "@/lib/errors/logger";
import { getSiteSettings } from "@/lib/platform/site-settings-server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getPublicSiteUrl } from "@/lib/site-url";

/** notification_log template key — must stay stable for idempotency. */
export const ACCOUNT_WELCOME_TEMPLATE = "account_welcome";

/**
 * Prefer treating accounts in this window as "new" (signUp → delayed confirm).
 * Auth `created_at` is set at signUp, not at confirm.
 */
export const NEW_ACCOUNT_WELCOME_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * First-ever welcome catch-up: preorder/contact flows often create auth users
 * days/weeks before the customer finishes UI registration. The 7d window then
 * permanently skipped them (`not_new_account`) even though notification_log
 * had never recorded a welcome. Bound so multi-year dormant accounts are not
 * surprised on a random return visit.
 */
export const NEVER_WELCOMED_CATCHUP_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

async function hasWelcomeAlreadySent(userId: string): Promise<boolean> {
  const admin = createAdminSupabase();
  if (!admin) return false;

  const { data, error } = await admin
    .from("notification_log")
    .select("id")
    .eq("template", ACCOUNT_WELCOME_TEMPLATE)
    .eq("source_table", "profiles")
    .eq("source_id", userId)
    .eq("channel", "email")
    .eq("status", "sent")
    .limit(1)
    .maybeSingle();

  if (error) {
    // Table/query may fail on older DBs — do not block; fall through and risk rare duplicate.
    console.warn("[welcome-email] notification_log lookup failed:", error.message);
    return false;
  }

  return Boolean(data?.id);
}

async function logWelcomeResult(params: {
  userId: string;
  email: string;
  status: "sent" | "failed";
  detail?: string;
  channel?: "email" | "sms";
  recipient?: string;
}): Promise<void> {
  const admin = createAdminSupabase();
  if (!admin) return;

  try {
    await admin.from("notification_log").insert({
      source_table: "profiles",
      source_id: params.userId,
      template: ACCOUNT_WELCOME_TEMPLATE,
      channel: params.channel ?? "email",
      status: params.status,
      recipient: params.recipient ?? params.email,
      detail: params.detail ?? null,
    });
  } catch (error) {
    console.warn(
      "[welcome-email] notification_log insert failed:",
      error instanceof Error ? error.message : error
    );
  }
}

export function isWithinWelcomeWindow(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= NEW_ACCOUNT_WELCOME_WINDOW_MS;
}

export function isWithinNeverWelcomedCatchupWindow(
  iso: string | null | undefined
): boolean {
  if (!iso) return false;
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= NEVER_WELCOMED_CATCHUP_WINDOW_MS;
}

/** Positively old vs new; `unknown` must not silently skip welcome. */
type WelcomeAge = "new" | "old" | "unknown";

function ageFromTimestamp(
  iso: string | null | undefined,
  windowMs: number = NEW_ACCOUNT_WELCOME_WINDOW_MS
): WelcomeAge {
  if (!iso) return "unknown";
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return "unknown";
  return Date.now() - created <= windowMs ? "new" : "old";
}

async function resolveAccountCreatedAt(
  userId: string
): Promise<string | null> {
  const admin = createAdminSupabase();
  if (!admin) return null;

  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (!error && data?.user?.created_at) {
      return data.user.created_at;
    }

    // External-auth profiles may not exist in auth.users — fall back to profile age.
    const { data: profile } = await admin
      .from("profiles")
      .select("created_at")
      .eq("id", userId)
      .maybeSingle();
    return typeof profile?.created_at === "string" ? profile.created_at : null;
  } catch (error) {
    console.warn(
      "[welcome-email] created_at check failed:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

async function resolveWelcomeAccountAge(userId: string): Promise<{
  age: WelcomeAge;
  createdAt: string | null;
}> {
  const createdAt = await resolveAccountCreatedAt(userId);
  return { age: ageFromTimestamp(createdAt), createdAt };
}

export type WelcomeEmailSendResult = {
  sent: boolean;
  /** Email channel outcome — false when Resend failed or was skipped. */
  emailSent: boolean;
  smsSent: boolean;
  reason?: string;
  resendId?: string;
};

/**
 * Sends a one-time branded welcome email for newly created customer accounts
 * (Google OAuth first signup, password registration, external-auth insert).
 * Idempotent via notification_log. Does not send login alerts on every sign-in.
 * SMS is optional and never blocks email success.
 */
export async function maybeSendCustomerWelcomeEmail(params: {
  userId: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  registrationId?: string | null;
  /** Skip the created_at window (caller already knows this insert is brand-new). */
  knownNewAccount?: boolean;
}): Promise<WelcomeEmailSendResult> {
  const email = params.email.trim().toLowerCase();
  if (!email || !params.userId) {
    console.warn("[welcome-email] skip: missing_email_or_user");
    return {
      sent: false,
      emailSent: false,
      smsSent: false,
      reason: "missing_email_or_user",
    };
  }

  if (await hasWelcomeAlreadySent(params.userId)) {
    console.info("[welcome-email] skip: already_sent", params.userId);
    return {
      sent: false,
      emailSent: false,
      smsSent: false,
      reason: "already_sent",
    };
  }

  if (!params.knownNewAccount) {
    const { age, createdAt } = await resolveWelcomeAccountAge(params.userId);
    if (age === "old") {
      // Never-welcomed catch-up: auth users often exist before UI "Create Account"
      // (preorder, contact, abandoned signup). notification_log already prevents
      // duplicates — only skip when the account is outside the catch-up window.
      if (isWithinNeverWelcomedCatchupWindow(createdAt)) {
        console.info(
          "[welcome-email] catchup_never_welcomed",
          params.userId
        );
      } else {
        console.info("[welcome-email] skip: not_new_account", params.userId);
        return {
          sent: false,
          emailSent: false,
          smsSent: false,
          reason: "not_new_account",
        };
      }
    }
    if (age === "unknown") {
      // Fail open: idempotency via notification_log prevents spam if we guess wrong.
      console.warn(
        "[welcome-email] account age unknown — sending welcome (idempotent)",
        params.userId
      );
    }
  }

  const settings = await getSiteSettings();
  const supportEmail = settings.email?.trim() || SITE_EMAIL;
  const supportPhone = settings.phone?.trim() || SITE_PHONE_DISPLAY;
  const accountUrl = `${getPublicSiteUrl()}/account`;
  const displayName = params.name?.trim() || "";

  const mail = welcomeEmail(displayName, accountUrl, {
    registrationId: params.registrationId?.trim() || undefined,
    customerId: params.userId,
    supportEmail,
    supportPhone,
  });

  let emailSent = false;
  let resendId: string | undefined;

  try {
    const result = await sendEmail({
      to: email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    emailSent = true;
    resendId = result.messageId;
    await logWelcomeResult({
      userId: params.userId,
      email,
      status: "sent",
      detail: result.messageId ? `resend_id=${result.messageId}` : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send failed";
    console.error("[welcome-email] Resend failed:", message);
    await logWelcomeResult({
      userId: params.userId,
      email,
      status: "failed",
      detail: message.slice(0, 500),
    });
    logAppError({
      error,
      module: "customer.welcome-email",
      userMessage: "The welcome email could not be sent.",
      kind: "external_service",
      status: 502,
      actor: { id: params.userId, type: "customer" },
      context: {
        provider: "resend",
        template: ACCOUNT_WELCOME_TEMPLATE,
        registrationId: params.registrationId ?? null,
      },
    });
    return {
      sent: false,
      emailSent: false,
      smsSent: false,
      reason: "send_failed",
    };
  }

  // Optional SMS when a phone is on file (non-blocking; email remains primary).
  let smsSent = false;
  let phone = params.phone?.trim() || null;
  if (!phone) {
    const admin = createAdminSupabase();
    if (admin) {
      const { data: profile } = await admin
        .from("profiles")
        .select("phone")
        .eq("id", params.userId)
        .maybeSingle();
      phone = profile?.phone?.trim() || null;
    }
  }

  if (phone) {
    try {
      const { sendArkeselSms } = await import("@/lib/notifications/arkesel");
      const ref = params.registrationId?.trim();
      const smsBody = ref
        ? `True Goshen: Welcome${displayName ? ` ${displayName}` : ""}! Account ${ref} is ready. Open: ${accountUrl}`
        : `True Goshen: Welcome${displayName ? ` ${displayName}` : ""}! Your account is ready. Open: ${accountUrl}`;
      const sms = await sendArkeselSms(phone, smsBody);
      if (sms.sent) {
        smsSent = true;
        await logWelcomeResult({
          userId: params.userId,
          email,
          status: "sent",
          channel: "sms",
          recipient: phone,
          detail: sms.messageId
            ? `arkesel message_id=${sms.messageId}`
            : undefined,
        });
      } else {
        console.warn("[welcome-email] SMS not sent:", sms.reason);
        await logWelcomeResult({
          userId: params.userId,
          email,
          status: "failed",
          channel: "sms",
          recipient: phone,
          detail: sms.reason.slice(0, 500),
        });
        logAppError({
          error: new Error(sms.reason),
          module: "customer.welcome-email.sms",
          userMessage: "The welcome SMS could not be sent.",
          kind: "external_service",
          status: 502,
          actor: { id: params.userId, type: "customer" },
          context: {
            provider: "arkesel",
            template: ACCOUNT_WELCOME_TEMPLATE,
            reason: sms.reason,
          },
        });
      }
    } catch (smsError) {
      const message =
        smsError instanceof Error ? smsError.message : "Welcome SMS failed";
      console.warn("[welcome-email] SMS skipped:", message);
      await logWelcomeResult({
        userId: params.userId,
        email,
        status: "failed",
        channel: "sms",
        recipient: phone,
        detail: message.slice(0, 500),
      });
      logAppError({
        error: smsError,
        module: "customer.welcome-email.sms",
        userMessage: "The welcome SMS could not be sent.",
        kind: "external_service",
        status: 502,
        actor: { id: params.userId, type: "customer" },
        context: { provider: "arkesel", template: ACCOUNT_WELCOME_TEMPLATE },
      });
    }
  }

  return {
    sent: emailSent,
    emailSent,
    smsSent,
    resendId,
    ...(phone ? {} : { reason: "email_sent_sms_skipped_no_phone" }),
  };
}

/**
 * Post-signup welcome for the register UI (session optional — email confirm may
 * defer login). Verifies the auth user exists, email matches, and was created
 * recently so callers cannot welcome arbitrary accounts.
 */
export async function sendCustomerWelcomeAfterSignup(params: {
  userId: string;
  email: string;
  name?: string | null;
  phone?: string | null;
}): Promise<WelcomeEmailSendResult> {
  const email = params.email.trim().toLowerCase();
  if (!email || !params.userId) {
    return {
      sent: false,
      emailSent: false,
      smsSent: false,
      reason: "missing_email_or_user",
    };
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return {
      sent: false,
      emailSent: false,
      smsSent: false,
      reason: "admin_unavailable",
    };
  }

  const { data, error } = await admin.auth.admin.getUserById(params.userId);
  const authUser = data?.user;

  const metaName =
    (typeof authUser?.user_metadata?.full_name === "string"
      ? authUser.user_metadata.full_name
      : null) ||
    (typeof authUser?.user_metadata?.name === "string"
      ? authUser.user_metadata.name
      : null);
  const metaPhone =
    typeof authUser?.user_metadata?.phone === "string"
      ? authUser.user_metadata.phone
      : null;

  // Ensure profile exists for admin Customers even when welcome email is skipped.
  let registrationId: string | null = null;
  try {
    const { ensureCustomerProfile } = await import(
      "@/lib/customer/preorder-account"
    );
    registrationId = await ensureCustomerProfile(
      params.userId,
      email,
      params.name?.trim() || metaName || email.split("@")[0] || "Customer",
      params.phone?.trim() || metaPhone || undefined
    );
  } catch (profileError) {
    console.warn(
      "[welcome-email] post-signup profile ensure failed:",
      profileError instanceof Error ? profileError.message : profileError
    );
  }

  if (error || !authUser) {
    console.warn("[welcome-email] post-signup user lookup failed:", error?.message);
    return {
      sent: false,
      emailSent: false,
      smsSent: false,
      reason: "user_not_found",
    };
  }

  const authEmail = (authUser.email ?? "").trim().toLowerCase();
  if (!authEmail || authEmail !== email) {
    console.warn("[welcome-email] post-signup email mismatch", params.userId);
    return {
      sent: false,
      emailSent: false,
      smsSent: false,
      reason: "email_mismatch",
    };
  }

  // Allow register → confirm → later call; still require a real recent signup.
  if (!isWithinNeverWelcomedCatchupWindow(authUser.created_at)) {
    console.info("[welcome-email] post-signup skip: not_new_account", params.userId);
    return {
      sent: false,
      emailSent: false,
      smsSent: false,
      reason: "not_new_account",
    };
  }

  return maybeSendCustomerWelcomeEmail({
    userId: params.userId,
    email,
    name: params.name?.trim() || metaName,
    phone: params.phone?.trim() || metaPhone,
    registrationId,
    // Register UI just created/claimed this account — do not re-apply the 7d gate.
    knownNewAccount: true,
  });
}
