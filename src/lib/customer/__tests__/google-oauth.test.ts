import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildOAuthCallbackUrl,
  resolveOAuthRedirectOrigin,
} from "@/lib/customer/google-oauth";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const originalEmergency = process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;

afterEach(() => {
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  }
  if (originalEmergency === undefined) {
    delete process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;
  } else {
    process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK = originalEmergency;
  }
  vi.unstubAllGlobals();
});

describe("Google OAuth redirect origin", () => {
  it("uses the canonical www site URL on the server", () => {
    delete process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.truegoshengh.com";
    expect(resolveOAuthRedirectOrigin()).toBe("https://www.truegoshengh.com");
  });

  it("never uses vercel.app even when the browser is on that host", () => {
    delete process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.truegoshengh.com";
    vi.stubGlobal("window", {
      location: {
        hostname: "truegoshen.vercel.app",
        origin: "https://truegoshen.vercel.app",
      },
    });
    expect(resolveOAuthRedirectOrigin()).toBe("https://www.truegoshengh.com");
    const callback = new URL(buildOAuthCallbackUrl("/account"));
    expect(callback.origin).toBe("https://www.truegoshengh.com");
    expect(callback.pathname).toBe("/auth/callback");
    expect(callback.searchParams.get("redirect")).toBe("/account");
    expect(callback.hostname).not.toMatch(/vercel\.app$/);
  });

  it("rewrites a misconfigured NEXT_PUBLIC_SITE_URL on vercel.app", () => {
    delete process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;
    process.env.NEXT_PUBLIC_SITE_URL = "https://truegoshen.vercel.app";
    expect(resolveOAuthRedirectOrigin()).toBe("https://www.truegoshengh.com");
  });

  it("keeps localhost for local auth testing", () => {
    delete process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.truegoshengh.com";
    vi.stubGlobal("window", {
      location: {
        hostname: "localhost",
        origin: "http://localhost:3000",
      },
    });
    expect(resolveOAuthRedirectOrigin()).toBe("http://localhost:3000");
  });
});
