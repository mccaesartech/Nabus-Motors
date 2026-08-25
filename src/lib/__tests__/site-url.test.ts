import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PRODUCTION_PUBLIC_SITE_URL,
  resolveCustomerApiUrl,
  resolvePublicSiteUrl,
} from "@/lib/site-url";
import { buildPlatformInviteUrl } from "@/lib/platform/invite-url";

const originalEmergency = process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalEmergency === undefined) {
    delete process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;
  } else {
    process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK = originalEmergency;
  }
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  }
  vi.unstubAllGlobals();
});

describe("canonical public site URL", () => {
  it("defaults production links to the custom www domain", () => {
    delete process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;
    expect(resolvePublicSiteUrl(undefined)).toBe(
      "https://www.truegoshengh.com"
    );
    expect(PRODUCTION_PUBLIC_SITE_URL).toBe("https://www.truegoshengh.com");
  });

  it("rewrites legacy Vercel deployment hostnames to the canonical domain", () => {
    delete process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;
    expect(resolvePublicSiteUrl("https://truegoshen.vercel.app")).toBe(
      PRODUCTION_PUBLIC_SITE_URL
    );
    expect(
      resolvePublicSiteUrl("https://truegoshenauto.vercel.app")
    ).toBe(PRODUCTION_PUBLIC_SITE_URL);
    expect(
      resolvePublicSiteUrl("https://true-goshen-auto-abc123.vercel.app")
    ).toBe(PRODUCTION_PUBLIC_SITE_URL);
  });

  it("preserves a valid explicitly configured custom production origin", () => {
    delete process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;
    expect(resolvePublicSiteUrl("https://www.truegoshen.com/path")).toBe(
      "https://www.truegoshen.com"
    );
    expect(resolvePublicSiteUrl("https://truegoshengh.com")).toBe(
      "https://truegoshengh.com"
    );
    expect(resolvePublicSiteUrl("https://www.truegoshengh.com/invite")).toBe(
      "https://www.truegoshengh.com"
    );
  });

  it("honors emergency fallback only when explicitly configured", () => {
    process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK =
      "https://truegoshen.vercel.app";
    expect(resolvePublicSiteUrl("https://www.truegoshengh.com")).toBe(
      "https://truegoshen.vercel.app"
    );
    expect(resolvePublicSiteUrl(undefined)).toBe(
      "https://truegoshen.vercel.app"
    );
  });

  it("allows localhost only in local development", () => {
    delete process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;
    expect(resolvePublicSiteUrl("http://localhost:3000")).toBe(
      PRODUCTION_PUBLIC_SITE_URL
    );
    expect(
      resolvePublicSiteUrl("http://localhost:3001/path", true)
    ).toBe("http://localhost:3001");
  });
});

describe("platform invitation URLs", () => {
  it("builds acceptance links on the supplied canonical origin", () => {
    expect(buildPlatformInviteUrl("token/with delimiter", PRODUCTION_PUBLIC_SITE_URL)).toBe(
      "https://www.truegoshengh.com/admin/platform/invite/token%2Fwith%20delimiter"
    );
  });

  it("uses /admin/platform/invite/{token}, not bare /admin", () => {
    const url = buildPlatformInviteUrl("abc123", PRODUCTION_PUBLIC_SITE_URL);
    expect(url).toBe("https://www.truegoshengh.com/admin/platform/invite/abc123");
    expect(url).not.toBe("https://www.truegoshengh.com/admin");
    expect(url).toContain("/admin/platform/invite/");
    expect(url).not.toContain("vercel.app");
    expect(url).not.toMatch(/https:\/\/[^/]+\/platform\/invite\//);
  });

  it("matches the canonical production Copy-link shape used by Platform Users UI", () => {
    const token = "deadbeefcafebabe";
    expect(buildPlatformInviteUrl(token, PRODUCTION_PUBLIC_SITE_URL)).toBe(
      `https://www.truegoshengh.com/admin/platform/invite/${token}`
    );
  });
});

describe("resolveCustomerApiUrl", () => {
  it("keeps relative paths on localhost", () => {
    vi.stubGlobal("window", {
      location: { hostname: "localhost", origin: "http://localhost:3000" },
    });
    expect(resolveCustomerApiUrl("/api/customer/notifications?limit=50")).toBe(
      "/api/customer/notifications?limit=50"
    );
  });

  it("forces the canonical www origin on production hosts including vercel.app", () => {
    delete process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.truegoshengh.com";
    vi.stubGlobal("window", {
      location: {
        hostname: "truegoshen.vercel.app",
        origin: "https://truegoshen.vercel.app",
      },
    });
    expect(resolveCustomerApiUrl("/api/customer/notifications?limit=50")).toBe(
      "https://www.truegoshengh.com/api/customer/notifications?limit=50"
    );
  });
});
