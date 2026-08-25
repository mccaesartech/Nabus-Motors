import type { User } from "@supabase/supabase-js";
import { customerLoginErrorMessage } from "@/lib/customer/login-errors";
import { ensureProfileRegistrationId } from "@/lib/customer/registration-id";
import { validateEmailForSignup } from "@/lib/email/validate-email-server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export type PreorderAccountResult = {
  userId: string | null;
  registrationId: string | null;
  error?: string;
};

function splitName(fullName: string) {
  const trimmed = fullName.trim();
  const spacePos = trimmed.indexOf(" ");
  return {
    firstName: spacePos > 0 ? trimmed.slice(0, spacePos) : trimmed,
    lastName: spacePos > 0 ? trimmed.slice(spacePos + 1).trim() : null,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wait for auth trigger / upsert to create the profiles row (avoids user_id FK failures). */
export async function waitForCustomerProfile(
  userId: string,
  maxAttempts = 6
): Promise<boolean> {
  const admin = createAdminSupabase();
  if (!admin) return false;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (data?.id) return true;
    await sleep(150 * (attempt + 1));
  }

  return false;
}

/** Ensure a profiles row exists so preorder_inquiries.user_id FK succeeds. */
export async function ensureCustomerProfile(
  userId: string,
  email: string,
  name: string,
  phone?: string
): Promise<string | null> {
  const admin = createAdminSupabase();
  if (!admin) return null;

  const { data: existing, error: readError } = await admin
    .from("profiles")
    .select("id, registration_id, phone, email, first_name, last_name")
    .eq("id", userId)
    .maybeSingle();

  if (readError) {
    console.warn("[preorder] profile lookup failed:", readError.message);
  }

  // Auth trigger often creates the row before sync — fill signup phone/email/name
  // when missing so welcome SMS and profile are not blank forever.
  if (existing) {
    const { firstName, lastName } = splitName(name);
    const updates: Record<string, unknown> = {};
    const trimmedPhone = phone?.trim() || "";
    const trimmedEmail = email.trim();

    if (trimmedPhone && !existing.phone?.trim()) {
      updates.phone = trimmedPhone;
    }
    if (trimmedEmail && !existing.email?.trim()) {
      updates.email = trimmedEmail;
    }
    if (firstName && !existing.first_name?.trim()) {
      updates.first_name = firstName;
    }
    if (lastName && !existing.last_name?.trim()) {
      updates.last_name = lastName;
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error: updateError } = await admin
        .from("profiles")
        .update(updates)
        .eq("id", userId);
      if (updateError) {
        console.warn(
          "[preorder] profile signup field backfill failed:",
          updateError.message
        );
      }
    }

    if (existing.registration_id?.trim()) {
      return existing.registration_id.trim();
    }
    return ensureProfileRegistrationId(admin, userId);
  }

  const { firstName, lastName } = splitName(name);
  const baseProfile = {
    id: userId,
    first_name: firstName,
    last_name: lastName,
    phone: phone?.trim() || null,
  };

  const { data: regId, error: regError } = await admin.rpc(
    "generate_registration_id"
  );

  if (!regError && regId) {
    const { data: created, error: createError } = await admin
      .from("profiles")
      .upsert(
        {
          ...baseProfile,
          email: email.trim(),
          registration_id: regId,
        },
        { onConflict: "id" }
      )
      .select("registration_id")
      .maybeSingle();

    if (!createError && created?.registration_id) {
      return created.registration_id;
    }

    if (createError) {
      console.warn("[preorder] profile upsert with registration_id failed:", createError.message);
    }
  }

  const { data: fallback, error: fallbackError } = await admin
    .from("profiles")
    .upsert(baseProfile, { onConflict: "id" })
    .select("registration_id")
    .maybeSingle();

  if (fallbackError) {
    console.warn("[preorder] profile upsert failed:", fallbackError.message);
    return null;
  }

  if (fallback?.registration_id?.trim()) {
    return fallback.registration_id.trim();
  }

  return ensureProfileRegistrationId(admin, userId);
}

/** Resolve authenticated user or create/sign-in via inline registration fields. */
export async function resolvePreorderAccount({
  authUser,
  email,
  name,
  phone,
  password,
}: {
  authUser: User | null;
  email: string;
  name: string;
  phone?: string;
  password?: string;
}): Promise<PreorderAccountResult> {
  if (authUser) {
    const registrationId = await ensureCustomerProfile(
      authUser.id,
      email,
      name,
      phone
    );
    return { userId: authUser.id, registrationId };
  }

  if (!password) {
    return { userId: null, registrationId: null };
  }

  if (password.length < 8) {
    return {
      userId: null,
      registrationId: null,
      error: "Password must be at least 8 characters.",
    };
  }

  const emailCheck = await validateEmailForSignup(email);
  if (!emailCheck.ok || !emailCheck.normalized) {
    return {
      userId: null,
      registrationId: null,
      error: emailCheck.message,
    };
  }

  const admin = createAdminSupabase();
  const serverSupabase = createServerSupabase();
  const trimmedEmail = emailCheck.normalized;

  if (serverSupabase) {
    const { data: signInData, error: signInError } =
      await serverSupabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

    if (signInData?.user) {
      const registrationId = await ensureCustomerProfile(
        signInData.user.id,
        trimmedEmail,
        name,
        phone
      );
      return { userId: signInData.user.id, registrationId };
    }

    if (
      signInError &&
      !signInError.message.toLowerCase().includes("invalid login credentials")
    ) {
      return {
        userId: null,
        registrationId: null,
        error: customerLoginErrorMessage(signInError.message),
      };
    }
  }

  if (!admin) {
    return { userId: null, registrationId: null };
  }

  const { data: createData, error: createError } =
    await admin.auth.admin.createUser({
      email: trimmedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name.trim(),
        phone: phone?.trim() ?? "",
      },
    });

  if (createError) {
    if (isExistingAccountError(createError.message)) {
      return {
        userId: null,
        registrationId: null,
        error:
          "An account with this email already exists. Enter the correct password to continue.",
      };
    }
    return {
      userId: null,
      registrationId: null,
      error: customerLoginErrorMessage(createError.message),
    };
  }

  if (!createData.user) {
    return { userId: null, registrationId: null };
  }

  const registrationId = await ensureCustomerProfile(
    createData.user.id,
    trimmedEmail,
    name,
    phone
  );
  const profileReady = await waitForCustomerProfile(createData.user.id);
  if (!profileReady) {
    console.warn("[preorder] profile not ready after account creation:", createData.user.id);
  }
  return { userId: createData.user.id, registrationId };
}

function isExistingAccountError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already registered") ||
    normalized.includes("already been registered") ||
    normalized.includes("user already exists") ||
    normalized.includes("already exists")
  );
}

/** Link orphan freight quotes (no user_id) to the signed-in account by email. */
export async function linkCustomerFreightQuotesByEmail(
  userId: string,
  email: string,
  registrationId?: string | null
): Promise<number> {
  const admin = createAdminSupabase();
  if (!admin) return 0;

  const normalizedEmail = email.trim().toLowerCase();
  const updates: Record<string, unknown> = { user_id: userId };
  if (registrationId) {
    updates.customer_registration_id = registrationId;
  }

  const { data, error } = await admin
    .from("freight_quote_requests")
    .update(updates)
    .is("user_id", null)
    .ilike("email", normalizedEmail)
    .select("id");

  if (error) {
    console.warn("[freight] link by email failed:", error.message);
    return 0;
  }

  return data?.length ?? 0;
}

/** Link orphan pre-orders (no user_id) to the signed-in account by email. */
export async function linkCustomerPreordersByEmail(
  userId: string,
  email: string,
  registrationId?: string | null
): Promise<number> {
  const admin = createAdminSupabase();
  if (!admin) return 0;

  const normalizedEmail = email.trim().toLowerCase();
  const updates: Record<string, unknown> = { user_id: userId };
  if (registrationId) {
    updates.customer_registration_id = registrationId;
  }

  const { data, error } = await admin
    .from("preorder_inquiries")
    .update(updates)
    .is("user_id", null)
    .ilike("email", normalizedEmail)
    .select("id");

  if (error) {
    console.warn("[preorder] link by email failed:", error.message);
    return 0;
  }

  return data?.length ?? 0;
}

/** Ensure profile email is set and orphan pre-orders are linked on login/account load. */
export async function syncCustomerAccount(
  userId: string,
  email: string,
  options?: { fullName?: string | null; phone?: string | null }
): Promise<{
  registrationId: string | null;
  linkedPreorders: number;
  linkedFreightQuotes: number;
  linkedPartsOrders: number;
  welcome?: {
    sent: boolean;
    emailSent: boolean;
    smsSent: boolean;
    reason?: string;
  };
}> {
  const admin = createAdminSupabase();
  if (!admin) {
    return { registrationId: null, linkedPreorders: 0, linkedFreightQuotes: 0, linkedPartsOrders: 0 };
  }

  const trimmedEmail = email.trim();
  const trimmedPhone = options?.phone?.trim() || null;
  const displayName =
    options?.fullName?.trim() ||
    trimmedEmail.split("@")[0] ||
    "Customer";

  let registrationId = await ensureCustomerProfile(
    userId,
    trimmedEmail,
    displayName,
    trimmedPhone || undefined
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("registration_id, email, phone, created_at")
    .eq("id", userId)
    .maybeSingle();

  registrationId = profile?.registration_id ?? registrationId;

  if (!profile?.email && trimmedEmail) {
    await admin
      .from("profiles")
      .update({ email: trimmedEmail })
      .eq("id", userId);
  }

  const { linkCustomerPartsOrdersByEmail } = await import("@/lib/customer/contact-account");

  const [linkedPreorders, linkedFreightQuotes, linkedPartsOrders] = await Promise.all([
    linkCustomerPreordersByEmail(userId, trimmedEmail, registrationId),
    linkCustomerFreightQuotesByEmail(userId, trimmedEmail, registrationId),
    linkCustomerPartsOrdersByEmail(userId, trimmedEmail),
  ]);

  // First-signup welcome (Google OAuth + password register). Idempotent; email is required.
  // Catch-up also covers preorder-created auth users who finish UI registration later.
  let welcome: {
    sent: boolean;
    emailSent: boolean;
    smsSent: boolean;
    reason?: string;
  } | undefined;

  try {
    const {
      maybeSendCustomerWelcomeEmail,
      isWithinWelcomeWindow,
      isWithinNeverWelcomedCatchupWindow,
    } = await import("@/lib/customer/welcome-email");
    const profileCreatedAt =
      typeof profile?.created_at === "string" ? profile.created_at : null;
    const knownNewAccount =
      isWithinWelcomeWindow(profileCreatedAt) ||
      isWithinNeverWelcomedCatchupWindow(profileCreatedAt);
    const result = await maybeSendCustomerWelcomeEmail({
      userId,
      email: trimmedEmail,
      name: displayName,
      phone: trimmedPhone || profile?.phone || null,
      registrationId,
      // Prefer profile age we already loaded — avoids a second auth lookup fail-closed.
      ...(knownNewAccount ? { knownNewAccount: true } : {}),
    });
    welcome = {
      sent: result.sent,
      emailSent: result.emailSent,
      smsSent: result.smsSent,
      ...(result.reason ? { reason: result.reason } : {}),
    };
    if (result.emailSent) {
      console.info(
        "[syncCustomerAccount] welcome email sent",
        result.smsSent ? "(sms too)" : "(sms skipped or failed)"
      );
    } else {
      console.warn(
        "[syncCustomerAccount] welcome email not sent:",
        result.reason ?? "unknown"
      );
    }
  } catch (error) {
    console.warn(
      "[syncCustomerAccount] welcome email failed:",
      error instanceof Error ? error.message : error
    );
    const { logAppError } = await import("@/lib/errors/logger");
    logAppError({
      error,
      module: "customer.syncCustomerAccount.welcome",
      userMessage: "The welcome email could not be sent.",
      kind: "external_service",
      status: 502,
      actor: { id: userId, type: "customer" },
    });
    welcome = {
      sent: false,
      emailSent: false,
      smsSent: false,
      reason: "send_failed",
    };
  }

  return {
    registrationId,
    linkedPreorders,
    linkedFreightQuotes,
    linkedPartsOrders,
    welcome,
  };
}
