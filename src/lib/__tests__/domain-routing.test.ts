import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { resolveLegacyVercelHostRedirect } from "@/lib/domain-routing";

const originalEmergency = process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.nabusmotors.com";
});

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
});

function request(host: string, path: string) {
  return new NextRequest(new URL(path, `https://${host}`), {
    headers: { host },
  });
}

describe("resolveLegacyVercelHostRedirect", () => {
  it("does not redirect when already on the canonical Vercel host", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://nabus-motors.vercel.app";
    expect(
      resolveLegacyVercelHostRedirect(request("nabus-motors.vercel.app", "/"))
    ).toBeNull();
  });

  it("308-redirects alias and preview vercel.app hosts including API", () => {
    delete process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;

    for (const host of [
      "nabus-motors.vercel.app",
      "nabus-motors.vercel.app",
      "nabusmotors-abc123-mccaesartech.vercel.app",
    ]) {
      const res = resolveLegacyVercelHostRedirect(
        request(host, "/api/customer/notifications?limit=50")
      );
      expect(res).not.toBeNull();
      expect(res!.status).toBe(308);
      expect(res!.headers.get("location")).toBe(
        `https://www.nabusmotors.com/api/customer/notifications?limit=50`
      );
    }
  });

  it("308-redirects service worker and account paths on vercel.app", () => {
    delete process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;
    const sw = resolveLegacyVercelHostRedirect(
      request("nabus-motors.vercel.app", "/serwist/sw.js")
    );
    expect(sw?.headers.get("location")).toBe(
      `https://www.nabusmotors.com/serwist/sw.js`
    );

    const account = resolveLegacyVercelHostRedirect(
      request("nabus-motors.vercel.app", "/account/settings")
    );
    expect(account?.headers.get("location")).toBe(
      `https://www.nabusmotors.com/account/settings`
    );
  });

  it("does not redirect the canonical custom domain", () => {
    delete process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;
    expect(
      resolveLegacyVercelHostRedirect(
        request("www.nabusmotors.com", "/api/customer/notifications")
      )
    ).toBeNull();
  });

  it("honors emergency vercel fallback host", () => {
    process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK =
      "https://nabus-motors.vercel.app";
    expect(
      resolveLegacyVercelHostRedirect(
        request("nabus-motors.vercel.app", "/account")
      )
    ).toBeNull();
    expect(
      resolveLegacyVercelHostRedirect(
        request("other-preview.vercel.app", "/account")
      )?.status
    ).toBe(308);
  });
});
