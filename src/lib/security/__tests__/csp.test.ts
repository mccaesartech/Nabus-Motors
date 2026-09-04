import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  createCspNonce,
} from "@/lib/security/csp";

describe("CSP builder", () => {
  it("creates a non-empty base64-ish nonce", () => {
    const nonce = createCspNonce();
    expect(nonce.length).toBeGreaterThan(10);
    expect(nonce).not.toContain("'");
  });

  it("builds a production policy without unsafe-inline/unsafe-eval in script-src", () => {
    const nonce = "testNonceValue123";
    const csp = buildContentSecurityPolicy({ nonce, isDev: false });

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).toContain("https://auth.nabusmotors.com");
    expect(csp).toContain("https://*.supabase.co");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("https://www.youtube-nocookie.com");
    expect(csp).toContain("https://maps.google.com");
    expect(csp).toContain("https://*.ingest.sentry.io");
  });

  it("allows unsafe-eval only in development and skips upgrade-insecure-requests", () => {
    const nonce = "devNonce";
    const csp = buildContentSecurityPolicy({ nonce, isDev: true });

    expect(csp).toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it("rejects an empty nonce", () => {
    expect(() => buildContentSecurityPolicy({ nonce: "  ", isDev: false })).toThrow(
      /nonce/i
    );
  });
});