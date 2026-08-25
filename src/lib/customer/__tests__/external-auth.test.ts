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
  it("honors auth.truegoshengh.com when configured as the auth service URL", () => {
    process.env.NEXT_PUBLIC_AUTH_SERVICE_URL =
      "https://auth.truegoshengh.com";
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.truegoshengh.com";

    expect(getAuthServiceUrl()).toBe("https://auth.truegoshengh.com");

    const login = new URL(getGoogleLoginUrl());
    expect(login.origin + login.pathname).toBe(
      "https://www.truegoshengh.com/login"
    );
    expect(login.hostname).not.toBe("auth.truegoshengh.com");
    expect(login.searchParams.get("oauth")).toBe("google");
  });

  it("falls back to NEXT_PUBLIC_SUPABASE_URL for auth service origin", () => {
    delete process.env.NEXT_PUBLIC_AUTH_SERVICE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth.truegoshengh.com";
    expect(getAuthServiceUrl()).toBe("https://auth.truegoshengh.com");
  });

  it("uses the app auth callback on the public site origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.truegoshengh.com";
    expect(externalAuthCallbackUrl()).toBe(
      "https://www.truegoshengh.com/auth/callback"
    );
  });
});
