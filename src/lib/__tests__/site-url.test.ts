import { describe, expect, it } from "vitest";
import {
  PRODUCTION_PUBLIC_SITE_URL,
  resolvePublicSiteUrl,
} from "@/lib/site-url";
import { buildPlatformInviteUrl } from "@/lib/platform/invite-url";

describe("canonical public site URL", () => {
  it("defaults production links to the canonical deployment", () => {
    expect(resolvePublicSiteUrl(undefined)).toBe(
      "https://truegoshen.vercel.app"
    );
  });

  it("repairs the legacy auto deployment hostname in production", () => {
    expect(
      resolvePublicSiteUrl("https://truegoshenauto.vercel.app")
    ).toBe(PRODUCTION_PUBLIC_SITE_URL);
  });

  it("preserves a valid explicitly configured custom production origin", () => {
    expect(resolvePublicSiteUrl("https://www.truegoshen.com/path")).toBe(
      "https://www.truegoshen.com"
    );
  });

  it("allows localhost only in local development", () => {
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
      "https://truegoshen.vercel.app/admin/platform/invite/token%2Fwith%20delimiter"
    );
  });
});
