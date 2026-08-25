import { sanitizeAuthRedirect } from "@/lib/customer/auth-redirect";
import { setSessionPreference } from "@/lib/customer/session-preference";
import { getPublicSiteUrl } from "@/lib/site-url";
import { supabase } from "@/lib/supabase/client";

/**
 * Origin for Supabase OAuth `redirectTo` (app `/auth/callback`).
 * Never use `window.location.origin` on *.vercel.app — that leaks the
 * deployment host into Google/Supabase redirect_to. Localhost keeps the
 * current origin for local auth testing.
 */
export function resolveOAuthRedirectOrigin(): string {
  const canonical = getPublicSiteUrl();
  if (typeof window === "undefined") return canonical;

  try {
    const { hostname, origin } = window.location;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]"
    ) {
      return origin;
    }
    if (hostname.endsWith(".vercel.app")) {
      return canonical;
    }
    return canonical;
  } catch {
    return canonical;
  }
}

export function buildOAuthCallbackUrl(redirectPath: string): string {
  const origin = resolveOAuthRedirectOrigin();
  const safeRedirect = sanitizeAuthRedirect(redirectPath);
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("redirect", safeRedirect);
  return callback.toString();
}

export type GoogleSignInResult =
  | { ok: true }
  | { ok: false; message: string };

/** Start Google OAuth via Supabase (browser redirect). */
export async function signInWithGoogle({
  redirectPath = "/account",
  rememberMe = false,
}: {
  redirectPath?: string;
  rememberMe?: boolean;
} = {}): Promise<GoogleSignInResult> {
  if (!supabase) {
    return {
      ok: false,
      message: "Account sign-in is not configured yet. Please try again later.",
    };
  }

  if (rememberMe) {
    setSessionPreference("stay_signed_in");
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: buildOAuthCallbackUrl(redirectPath),
      queryParams: {
        access_type: "online",
        prompt: "select_account",
      },
    },
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}
