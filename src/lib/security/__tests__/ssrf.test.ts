import { afterEach, describe, expect, it } from "vitest";
import {
  sanitizeAuthRedirect,
  authRedirectFromSearchParams,
} from "@/lib/customer/auth-redirect";
import { getAuthServiceUrl } from "@/lib/customer/external-auth";
import { buildOAuthCallbackUrl } from "@/lib/customer/google-oauth";

const originalAuthUrl = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL;
const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalAuthUrl === undefined) delete process.env.NEXT_PUBLIC_AUTH_SERVICE_URL;
  else process.env.NEXT_PUBLIC_AUTH_SERVICE_URL = originalAuthUrl;
  if (originalSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe("SSRF / open-redirect URL controls", () => {
  it("rejects protocol-relative and absolute redirect targets", () => {
    expect(sanitizeAuthRedirect("//evil.example/phish")).toBe("/account");
    expect(sanitizeAuthRedirect("https://evil.example")).toBe("/account");
    expect(sanitizeAuthRedirect("javascript:alert(1)")).toBe("/account");
    expect(sanitizeAuthRedirect("")).toBe("/account");
    expect(sanitizeAuthRedirect(null)).toBe("/account");
  });

  it("allows only in-app absolute paths", () => {
    expect(sanitizeAuthRedirect("/account/settings")).toBe("/account/settings");
    expect(sanitizeAuthRedirect("/dashboard")).toBe("/dashboard");
  });

  it("reads redirect/next query params through the same sanitizer", () => {
    const params = new URLSearchParams({
      redirect: "//evil.example",
      next: "/safe",
    });
    // redirect wins but is sanitized to fallback
    expect(authRedirectFromSearchParams(params)).toBe("/account");
    expect(
      authRedirectFromSearchParams(new URLSearchParams({ next: "/orders" }))
    ).toBe("/orders");
  });

  it("auth service URL is origin-only (no user-controlled fetch path)", () => {
    process.env.NEXT_PUBLIC_AUTH_SERVICE_URL =
      "https://auth.nabusmotors.com/extra/path?q=1";
    expect(getAuthServiceUrl()).toBe("https://auth.nabusmotors.com");
    const sessionUrl = new URL("/api/auth/session", getAuthServiceUrl());
    expect(sessionUrl.origin).toBe("https://auth.nabusmotors.com");
    expect(sessionUrl.pathname).toBe("/api/auth/session");
  });

  it("OAuth callback keeps sanitized redirect on the public app origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.nabusmotors.com";
    const callback = new URL(buildOAuthCallbackUrl("//evil.example"));
    expect(callback.origin).toBe("https://www.nabusmotors.com");
    expect(callback.pathname).toBe("/auth/callback");
    expect(callback.searchParams.get("redirect")).toBe("/account");
  });
});
