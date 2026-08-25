import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { resolveLegacyVercelHostRedirect } from "@/lib/domain-routing";
import { PRODUCTION_PUBLIC_SITE_URL } from "@/lib/site-url";

const originalEmergency = process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;

afterEach(() => {
  if (originalEmergency === undefined) {
    delete process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;
  } else {
    process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK = originalEmergency;
  }
});

function request(host: string, path: string) {
  return new NextRequest(new URL(path, `https://${host}`), {
    headers: { host },
  });
}

describe("resolveLegacyVercelHostRedirect", () => {
  it("308-redirects alias and preview vercel.app hosts including API", () => {
    delete process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;

    for (const host of [
      "truegoshen.vercel.app",
      "truegoshenauto.vercel.app",
      "truegoshenauto-abc123-mccaesartech.vercel.app",
    ]) {
      const res = resolveLegacyVercelHostRedirect(
        request(host, "/api/customer/notifications?limit=50")
      );
      expect(res).not.toBeNull();
      expect(res!.status).toBe(308);
      expect(res!.headers.get("location")).toBe(
        `${PRODUCTION_PUBLIC_SITE_URL}/api/customer/notifications?limit=50`
      );
    }
  });

  it("308-redirects service worker and account paths on vercel.app", () => {
    delete process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;
    const sw = resolveLegacyVercelHostRedirect(
      request("truegoshen.vercel.app", "/serwist/sw.js")
    );
    expect(sw?.headers.get("location")).toBe(
      `${PRODUCTION_PUBLIC_SITE_URL}/serwist/sw.js`
    );

    const account = resolveLegacyVercelHostRedirect(
      request("truegoshen.vercel.app", "/account/settings")
    );
    expect(account?.headers.get("location")).toBe(
      `${PRODUCTION_PUBLIC_SITE_URL}/account/settings`
    );
  });

  it("does not redirect the canonical custom domain", () => {
    delete process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK;
    expect(
      resolveLegacyVercelHostRedirect(
        request("www.truegoshengh.com", "/api/customer/notifications")
      )
    ).toBeNull();
  });

  it("honors emergency vercel fallback host", () => {
    process.env.PUBLIC_SITE_URL_EMERGENCY_FALLBACK =
      "https://truegoshen.vercel.app";
    expect(
      resolveLegacyVercelHostRedirect(
        request("truegoshen.vercel.app", "/account")
      )
    ).toBeNull();
    expect(
      resolveLegacyVercelHostRedirect(
        request("other-preview.vercel.app", "/account")
      )?.status
    ).toBe(308);
  });
});
