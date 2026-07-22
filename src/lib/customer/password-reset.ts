import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getAutoSiteUrl } from "@/lib/site-url";
import { normalizePhoneDigits } from "@/lib/notifications/phone";
import { notifyCustomer } from "@/lib/notifications/customer-notify";
import type { CustomerNotificationPayload } from "@/lib/notifications/notification-status";

export function getPasswordResetRedirectUrl(): string {
  return `${getAutoSiteUrl()}/reset-password`;
}

/** Rewrite localhost redirect_to in Supabase recovery links (dashboard Site URL leak). */
export function sanitizeRecoveryActionLink(actionLink: string): string {
  const productionRedirect = getPasswordResetRedirectUrl();

  try {
    const url = new URL(actionLink);
    const redirectTo = url.searchParams.get("redirect_to");
    if (!redirectTo) return actionLink;

    if (!redirectTo.includes("localhost") && !redirectTo.includes("127.0.0.1")) {
      return actionLink;
    }

    url.searchParams.set("redirect_to", productionRedirect);
    return url.toString();
  } catch {
    return actionLink;
  }
}

export type CustomerAccountLookup = {
  userId: string | null;
  email: string;
  phone: string | null;
  whatsappOptIn: boolean | null;
  customerName: string;
  referenceCode: string | null;
  sourceTable: string;
  sourceId: string | null;
};

type InquiryRow = {
  email: string | null;
  name: string | null;
  phone: string | null;
  user_id: string | null;
  reference_code: string | null;
  whatsapp_opt_in: boolean | null;
  customer_registration_id?: string | null;
};

function profileDisplayName(row: {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}): string {
  const full = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  return full || row.email || "Customer";
}

function phoneMatches(stored: string | null | undefined, queryDigits: string): boolean {
  if (!stored?.trim() || !queryDigits) return false;
  const storedDigits = normalizePhoneDigits(stored);
  return (
    storedDigits === queryDigits ||
    storedDigits.endsWith(queryDigits.slice(-9)) ||
    queryDigits.endsWith(storedDigits.slice(-9))
  );
}

function phoneSearchSuffix(phone: string): string {
  const digits = normalizePhoneDigits(phone);
  const local = digits.startsWith("233") ? digits.slice(3) : digits.replace(/^0+/, "");
  return local.slice(-9);
}

async function logPasswordResetEvent(row: {
  sourceTable?: string;
  sourceId?: string | null;
  channel: "email" | "whatsapp";
  status: "sent" | "failed" | "skipped" | "deferred";
  recipient: string;
  detail?: string;
}) {
  const supabase = createAdminSupabase();
  if (!supabase) return;

  try {
    await supabase.from("notification_log").insert({
      source_table: row.sourceTable ?? null,
      source_id: row.sourceId ?? null,
      template: "password_reset",
      channel: row.channel,
      status: row.status,
      recipient: row.recipient,
      detail: row.detail ?? null,
    });
  } catch {
    // Non-blocking
  }
}

async function latestReferenceForCustomer(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  userId: string | null,
  email: string
): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();

  const quoteQuery = admin
    .from("freight_quote_requests")
    .select("reference_code")
    .not("reference_code", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (userId) {
    quoteQuery.or(`user_id.eq.${userId},email.ilike.${normalizedEmail}`);
  } else {
    quoteQuery.ilike("email", normalizedEmail);
  }

  const { data: quote } = await quoteQuery.maybeSingle();
  if (quote?.reference_code) return quote.reference_code;

  const preorderQuery = admin
    .from("preorder_inquiries")
    .select("reference_code, customer_registration_id")
    .order("created_at", { ascending: false })
    .limit(1);

  if (userId) {
    preorderQuery.or(`user_id.eq.${userId},email.ilike.${normalizedEmail}`);
  } else {
    preorderQuery.ilike("email", normalizedEmail);
  }

  const { data: preorder } = await preorderQuery.maybeSingle();
  return preorder?.reference_code ?? preorder?.customer_registration_id ?? null;
}

async function resolveAuthEmail(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  userId: string | null,
  emailHint: string
): Promise<{ userId: string; email: string } | null> {
  if (userId) {
    const { data } = await admin.auth.admin.getUserById(userId);
    const authUser = data?.user;
    const authEmail = authUser?.email?.trim().toLowerCase();
    if (authEmail && authUser) {
      return { userId: authUser.id, email: authEmail };
    }
  }

  const normalizedHint = emailHint.trim().toLowerCase();
  if (!normalizedHint) return null;

  return null;
}

function mapInquiryRow(
  row: InquiryRow,
  sourceTable: "freight_quote_requests" | "preorder_inquiries",
  sourceId: string
): CustomerAccountLookup | null {
  const email = row.email?.trim();
  if (!email) return null;

  return {
    userId: row.user_id,
    email,
    phone: row.phone,
    whatsappOptIn: row.whatsapp_opt_in,
    customerName: row.name?.trim() || email,
    referenceCode:
      row.reference_code ??
      (sourceTable === "preorder_inquiries" ? row.customer_registration_id ?? null : null),
    sourceTable,
    sourceId,
  };
}

async function lookupByPhone(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  trimmed: string
): Promise<CustomerAccountLookup | null> {
  const queryDigits = normalizePhoneDigits(trimmed);
  const suffix = phoneSearchSuffix(trimmed);

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, first_name, last_name, phone, whatsapp_opt_in")
    .not("phone", "is", null)
    .or(`phone.ilike.%${suffix}%,phone.ilike.%${queryDigits}%`)
    .limit(50);

  const profile =
    (profiles ?? []).find((row) => phoneMatches(row.phone, queryDigits)) ?? null;

  if (profile) {
    let email = profile.email?.trim() || null;
    if (!email) {
      const auth = await resolveAuthEmail(admin, profile.id, "");
      email = auth?.email ?? null;
    }
    if (email) {
      const referenceCode = await latestReferenceForCustomer(admin, profile.id, email);
      return {
        userId: profile.id,
        email,
        phone: profile.phone,
        whatsappOptIn: profile.whatsapp_opt_in,
        customerName: profileDisplayName({ ...profile, email }),
        referenceCode,
        sourceTable: "profiles",
        sourceId: profile.id,
      };
    }
  }

  const { data: quotes } = await admin
    .from("freight_quote_requests")
    .select(
      "id, email, name, phone, user_id, reference_code, whatsapp_opt_in"
    )
    .not("phone", "is", null)
    .or(`phone.ilike.%${suffix}%,phone.ilike.%${queryDigits}%`)
    .order("created_at", { ascending: false })
    .limit(20);

  const quote = (quotes ?? []).find((row) => phoneMatches(row.phone, queryDigits));
  if (quote?.email) {
    return mapInquiryRow(quote, "freight_quote_requests", quote.id);
  }

  const { data: preorders } = await admin
    .from("preorder_inquiries")
    .select(
      "id, email, name, phone, user_id, reference_code, customer_registration_id, whatsapp_opt_in"
    )
    .not("phone", "is", null)
    .or(`phone.ilike.%${suffix}%,phone.ilike.%${queryDigits}%`)
    .order("created_at", { ascending: false })
    .limit(20);

  const preorder = (preorders ?? []).find((row) => phoneMatches(row.phone, queryDigits));
  if (preorder?.email) {
    return mapInquiryRow(preorder, "preorder_inquiries", preorder.id);
  }

  return null;
}

/** Resolve a customer account by email or phone number. */
export async function lookupCustomerAccount(
  emailOrPhone: string
): Promise<CustomerAccountLookup | null> {
  const admin = createAdminSupabase();
  if (!admin) return null;

  const trimmed = emailOrPhone.trim();
  if (!trimmed) return null;

  const isEmail = trimmed.includes("@");

  if (!isEmail) {
    return lookupByPhone(admin, trimmed);
  }

  const normalizedEmail = trimmed.toLowerCase();

  const [{ data: profile }, { data: quote }, { data: preorder }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, first_name, last_name, phone, whatsapp_opt_in")
      .ilike("email", normalizedEmail)
      .maybeSingle(),
    admin
      .from("freight_quote_requests")
      .select("id, email, name, phone, user_id, reference_code, whatsapp_opt_in")
      .ilike("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("preorder_inquiries")
      .select(
        "id, email, name, phone, user_id, reference_code, customer_registration_id, whatsapp_opt_in"
      )
      .ilike("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profile) {
    let email = profile.email?.trim() || null;
    if (!email) {
      const auth = await resolveAuthEmail(admin, profile.id, normalizedEmail);
      email = auth?.email ?? null;
    }
    if (email) {
      const referenceCode = await latestReferenceForCustomer(admin, profile.id, email);
      return {
        userId: profile.id,
        email,
        phone: profile.phone,
        whatsappOptIn: profile.whatsapp_opt_in,
        customerName: profileDisplayName({ ...profile, email }),
        referenceCode,
        sourceTable: "profiles",
        sourceId: profile.id,
      };
    }
  }

  if (quote?.email) {
    return mapInquiryRow(quote, "freight_quote_requests", quote.id);
  }

  if (preorder?.email) {
    return mapInquiryRow(preorder, "preorder_inquiries", preorder.id);
  }

  return null;
}

/** Resolve auth email for recovery — generateLink requires auth.users. */
export async function resolveCustomerRecoveryAccount(
  account: CustomerAccountLookup
): Promise<{ userId: string; email: string } | null> {
  const admin = createAdminSupabase();
  if (!admin) return null;
  return resolveAuthEmail(admin, account.userId, account.email);
}

/** Generate a one-time Supabase recovery link (never exposes the password). */
export async function generateCustomerPasswordResetLink(
  email: string,
  logContext?: { sourceTable?: string; sourceId?: string | null }
): Promise<{ resetUrl: string } | { error: string }> {
  const admin = createAdminSupabase();
  if (!admin) {
    return { error: "Password reset is not configured." };
  }

  const trimmedEmail = email.trim().toLowerCase();
  const redirectTo = getPasswordResetRedirectUrl();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: trimmedEmail,
    options: { redirectTo },
  });

  if (error) {
    const detail = `generateLink: ${error.message} | redirectTo=${redirectTo}`;
    console.warn("[password-reset] generateLink failed:", detail);
    await logPasswordResetEvent({
      sourceTable: logContext?.sourceTable,
      sourceId: logContext?.sourceId,
      channel: "email",
      status: "failed",
      recipient: trimmedEmail,
      detail,
    });
    return { error: "Could not generate reset link." };
  }

  const rawActionLink = data.properties?.action_link;
  if (!rawActionLink) {
    await logPasswordResetEvent({
      sourceTable: logContext?.sourceTable,
      sourceId: logContext?.sourceId,
      channel: "email",
      status: "failed",
      recipient: trimmedEmail,
      detail: "generateLink returned no action_link",
    });
    return { error: "Could not generate reset link." };
  }

  const resetUrl = sanitizeRecoveryActionLink(rawActionLink);
  if (resetUrl !== rawActionLink) {
    console.warn(
      "[password-reset] Rewrote localhost redirect in action_link:",
      `redirectTo=${getPasswordResetRedirectUrl()}`
    );
  }

  return { resetUrl };
}

/** Supabase built-in auth email — fallback when Resend is not configured or fails. */
export async function sendSupabaseAuthPasswordReset(
  email: string,
  logContext?: { sourceTable?: string; sourceId?: string | null }
): Promise<boolean> {
  const admin = createAdminSupabase();
  if (!admin) return false;

  const trimmedEmail = email.trim().toLowerCase();
  const redirectTo = getPasswordResetRedirectUrl();

  const { error } = await admin.auth.resetPasswordForEmail(trimmedEmail, {
    redirectTo,
  });

  if (error) {
    const detail = `supabase_auth: ${error.message} | redirectTo=${redirectTo}`;
    console.warn("[password-reset] Supabase resetPasswordForEmail failed:", detail);
    await logPasswordResetEvent({
      sourceTable: logContext?.sourceTable,
      sourceId: logContext?.sourceId,
      channel: "email",
      status: "failed",
      recipient: trimmedEmail,
      detail,
    });
    return false;
  }

  console.info("[password-reset] Supabase auth reset email triggered; recipient omitted");
  await logPasswordResetEvent({
    sourceTable: logContext?.sourceTable,
    sourceId: logContext?.sourceId,
    channel: "email",
    status: "sent",
    recipient: trimmedEmail,
    detail: `supabase_auth_primary | redirectTo=${redirectTo}`,
  });
  return true;
}

export async function sendCustomerPasswordReset(params: {
  email: string;
  phone?: string | null;
  whatsappPreferred?: boolean;
  customerName?: string;
  referenceCode?: string | null;
  sourceTable?: string;
  sourceId?: string | null;
}): Promise<{
  ok: boolean;
  emailSent: boolean;
  whatsappSent: boolean;
  notification?: CustomerNotificationPayload;
  error?: string;
  resetUrl?: string;
  emailDeliveryMethod?: "supabase" | "resend";
  recipientEmail?: string;
}> {
  const logContext = {
    sourceTable: params.sourceTable,
    sourceId: params.sourceId,
  };
  const recipientEmail = params.email.trim().toLowerCase();

  const linkResult = await generateCustomerPasswordResetLink(params.email, logContext);
  if ("error" in linkResult) {
    return {
      ok: false,
      emailSent: false,
      whatsappSent: false,
      error: linkResult.error,
      recipientEmail,
    };
  }

  const resetUrl = linkResult.resetUrl;

  // Primary: Supabase Auth email (uses project SMTP when configured).
  let emailSent = await sendSupabaseAuthPasswordReset(params.email, logContext);
  let emailDeliveryMethod: "supabase" | "resend" | undefined = emailSent ? "supabase" : undefined;

  const notify = await notifyCustomer({
    email: params.email,
    phone: params.phone,
    whatsappPreferred: params.whatsappPreferred,
    customerName: params.customerName,
    template: "password_reset",
    data: {
      passwordResetUrl: resetUrl,
      referenceCode: params.referenceCode ?? undefined,
    },
    sourceTable: params.sourceTable ?? "profiles",
    sourceId: params.sourceId ?? undefined,
    emailRequired: true,
    skipEmail: emailSent,
  });

  let notification: CustomerNotificationPayload = notify;

  // Secondary: branded Resend email with action_link when Supabase did not deliver.
  if (!emailSent && notify.emailSent) {
    emailSent = true;
    emailDeliveryMethod = "resend";
    notification = { ...notify, emailStatus: "sent" };
  } else if (!emailSent) {
    console.warn("[password-reset] Supabase + Resend both failed:", {
      whatsappSent: notify.whatsappSent,
      deliveryDetailOmitted: true,
    });
  } else if (emailSent && notify.emailSent) {
    // Supabase sent; Resend was skipped — reflect Supabase in notification payload.
    notification = {
      ...notify,
      emailSent: true,
      emailStatus: "sent",
      channels: notify.channels.includes("email")
        ? notify.channels
        : [...notify.channels, "email"],
    };
  }

  if (!emailSent) {
    const emailReason =
      notify.emailReason ??
      "Could not deliver password reset email. Verify Resend domain or Supabase SMTP.";
    return {
      ok: false,
      emailSent: false,
      whatsappSent: notify.whatsappSent,
      notification: { ...notification, emailStatus: "failed", emailReason },
      error: `Email failed: ${emailReason}`,
      resetUrl,
      recipientEmail,
    };
  }

  return {
    ok: true,
    emailSent: true,
    whatsappSent: notify.whatsappSent,
    notification,
    resetUrl,
    recipientEmail,
    emailDeliveryMethod,
  };
}
