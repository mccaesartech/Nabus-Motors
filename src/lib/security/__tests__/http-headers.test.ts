import { describe, expect, it } from "vitest";
import {
  BASE_SECURITY_HEADERS,
  HSTS_VALUE,
  PERMISSIONS_POLICY_VALUE,
  applyBaseSecurityHeaders,
} from "@/lib/security/http-headers";

describe("HTTP security headers", () => {
  it("includes preload-ready HSTS with includeSubDomains", () => {
    expect(HSTS_VALUE).toBe(
      "max-age=31536000; includeSubDomains; preload"
    );
  });

  it("exports CORP same-origin and OAuth-friendly COOP", () => {
    const map = Object.fromEntries(
      BASE_SECURITY_HEADERS.map((h) => [h.key, h.value])
    );
    expect(map["Cross-Origin-Resource-Policy"]).toBe("same-origin");
    expect(map["Cross-Origin-Opener-Policy"]).toBe(
      "same-origin-allow-popups"
    );
    expect(map["X-Frame-Options"]).toBe("DENY");
    expect(map["X-Content-Type-Options"]).toBe("nosniff");
    expect(map["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(map["Permissions-Policy"]).toBe(PERMISSIONS_POLICY_VALUE);
    expect(map).not.toHaveProperty("Cross-Origin-Embedder-Policy");
    expect(map).not.toHaveProperty("Content-Security-Policy");
  });

  it("applies headers onto a Headers instance", () => {
    const headers = new Headers();
    applyBaseSecurityHeaders(headers);
    expect(headers.get("Strict-Transport-Security")).toBe(HSTS_VALUE);
    expect(headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
  });
});
