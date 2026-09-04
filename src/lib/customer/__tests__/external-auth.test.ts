import { afterEach, describe, expect, it } from "vitest";
import {
  externalAuthCallbackUrl,
  getAuthServiceUrl,
  getGoogleLoginUrl,
} from "@/lib/customer/external-auth";

const originalAuthUrl = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL;
const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_AUTH_SERVICE_URL = originalAuthUrl;
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
  process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe("external customer authentication URLs", () => {
  it("honors auth.nabusmotors.com when configured as the auth service URL", () => {
    process.env.NEXT_PUBLIC_AUTH_SERVICE_URL =
      "https://auth.nabusmotors.com";
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.nabusmotors.com";

    expect(getAuthServiceUrl()).toBe("https://auth.nabusmotors.com");

    const login = new URL(getGoogleLoginUrl());
    expect(login.origin + login.pathname).toBe(
      "https://www.nabusmotors.com/login"
    );
    expect(login.hostname).not.toBe("auth.nabusmotors.com");
    expect(login.searchParams.get("oauth")).toBe("google");
  });

  it("falls back to NEXT_PUBLIC_SUPABASE_URL for auth service origin", () => {
    delete process.env.NEXT_PUBLIC_AUTH_SERVICE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth.nabusmotors.com";
    expect(getAuthServiceUrl()).toBe("https://auth.nabusmotors.com");
  });

  it("uses the app auth callback on the public site origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.nabusmotors.com";
    expect(externalAuthCallbackUrl()).toBe(
      "https://www.nabusmotors.com/auth/callback"
    );
  });
});
