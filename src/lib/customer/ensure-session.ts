import { markSessionPreferencePromptPending } from "@/lib/customer/session-preference";
import { customerLoginErrorMessage } from "@/lib/customer/login-errors";
import { validateEmailLocal } from "@/lib/email/validate-email";
import { supabase } from "@/lib/supabase/client";

export type EnsureCustomerSessionResult =
  | { ok: true; token: string }
  | { ok: false; message: string };

function isExistingAccountError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already registered") ||
    normalized.includes("already been registered") ||
    normalized.includes("user already exists")
  );
}

/** Create a customer account or sign in with existing credentials. */
export async function ensureCustomerSession({
  email,
  password,
  fullName,
  phone,
}: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}): Promise<EnsureCustomerSessionResult> {
  if (!supabase) {
    return { ok: false, message: "Account registration is not configured yet." };
  }

  const localEmail = validateEmailLocal(email);
  if (!localEmail.ok || !localEmail.normalized) {
    return { ok: false, message: localEmail.message };
  }

  try {
    const validateRes = await fetch("/api/customer/validate-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: localEmail.normalized }),
    });
    const validateBody = (await validateRes.json().catch(() => null)) as {
      ok?: boolean;
      message?: string;
    } | null;
    if (!validateRes.ok || !validateBody?.ok) {
      return {
        ok: false,
        message:
          validateBody?.message || "This email domain looks invalid.",
      };
    }
  } catch {
    return { ok: false, message: "Could not verify email. Please try again." };
  }

  const trimmedEmail = localEmail.normalized;

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: {
      data: {
        full_name: fullName.trim(),
        phone: phone.trim(),
      },
    },
  });

  if (!signUpError && signUpData.session?.access_token) {
    markSessionPreferencePromptPending();
    return { ok: true, token: signUpData.session.access_token };
  }

  if (signUpError && !isExistingAccountError(signUpError.message)) {
    return { ok: false, message: signUpError.message };
  }

  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

  if (signInError) {
    return {
      ok: false,
      message: isExistingAccountError(signUpError?.message ?? "")
        ? "An account with this email already exists. Enter the correct password or sign in from the login page."
        : customerLoginErrorMessage(signInError.message),
    };
  }

  if (signInData.session?.access_token) {
    return { ok: true, token: signInData.session.access_token };
  }

  return {
    ok: false,
    message: "Please confirm your email before signing in. Check your inbox.",
  };
}
