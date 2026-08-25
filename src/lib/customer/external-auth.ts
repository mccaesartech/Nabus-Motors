import { getPublicSiteUrl } from "@/lib/site-url";

/**
 * Dedicated auth-service origin (future / optional).
 * Customer Google sign-in must use Supabase `signInWithOAuth` (google-oauth.ts).
 * Prefer NEXT_PUBLIC_SUPABASE_URL / Custom Domain when configured.
 */
export const DEFAULT_AUTH_SERVICE_URL =
  "https://ddrknhvkhmgdtavpuiiq.supabase.co";
/** Matches PRODUCTION_PUBLIC_SITE_URL (canonical www). */
export const DEFAULT_PUBLIC_APP_URL = "https://www.truegoshengh.com";
export const CUSTOMER_DASHBOARD_PATH = "/dashboard";

export type ExternalAuthUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  user_metadata?: Record<string, unknown>;
};

export type ExternalAuthSession = {
  user: ExternalAuthUser;
  expires?: string | null;
};

function normalizeOrigin(value: string | undefined, fallback: string): string {
  try {
    return new URL(value?.trim() || fallback).origin;
  } catch {
    return fallback;
  }
}

export function getAuthServiceUrl(): string {
  return normalizeOrigin(
    process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ??
      process.env.AUTH_SERVICE_URL ??
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    DEFAULT_AUTH_SERVICE_URL
  );
}

/** Public app origin for auth callbacks — same canonical rules as invites/metadata. */
export function getPublicAppUrl(): string {
  return getPublicSiteUrl();
}

/**
 * @deprecated Prefer `signInWithGoogle` (Supabase OAuth).
 * Kept for callers that need an app-origin login deep link with oauth=google.
 */
export function getGoogleLoginUrl(): string {
  const url = new URL("/login", getPublicAppUrl());
  url.searchParams.set("oauth", "google");
  url.searchParams.set(
    "redirect",
    new URL(CUSTOMER_DASHBOARD_PATH, getPublicAppUrl()).pathname
  );
  return url.toString();
}

export function getExternalLoginUrl(): string {
  const url = new URL("/login", getPublicAppUrl());
  url.searchParams.set(
    "redirect",
    new URL(CUSTOMER_DASHBOARD_PATH, getPublicAppUrl()).pathname
  );
  return url.toString();
}

export function getExternalRegisterUrl(): string {
  const url = new URL("/register", getPublicAppUrl());
  url.searchParams.set(
    "callbackUrl",
    new URL(CUSTOMER_DASHBOARD_PATH, getPublicAppUrl()).toString()
  );
  return url.toString();
}

export function getExternalPasswordResetUrl(): string {
  return new URL("/forgot-password", getPublicAppUrl()).toString();
}

export function getExternalLogoutUrl(): string {
  const url = new URL("/logout", getAuthServiceUrl());
  url.searchParams.set("callbackUrl", getPublicAppUrl());
  return url.toString();
}

export function externalAuthCallbackUrl(): string {
  return new URL("/auth/callback", getPublicAppUrl()).toString();
}
