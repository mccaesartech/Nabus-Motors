import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { welcomeEmail } from "@/lib/email/branded-templates";
import { mediaBytesMatchMime } from "@/lib/security/media-signature";

describe("XSS defenses", () => {
  it("HTML-escapes untrusted names in branded email templates", () => {
    const mail = welcomeEmail(
      `<img src=x onerror=alert(1)>`,
      "https://www.truegoshengh.com/account"
    );
    expect(mail.html).not.toContain("<img");
    expect(mail.html).not.toMatch(/<img[^>]*onerror=/i);
    expect(mail.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("rejects script-like payloads presented as image uploads", () => {
    const payload = new TextEncoder().encode("<script>alert(1)</script>");
    expect(mediaBytesMatchMime(payload, "image/png")).toBe(false);
    expect(mediaBytesMatchMime(payload, "image/jpeg")).toBe(false);
    expect(mediaBytesMatchMime(payload, "image/webp")).toBe(false);
  });

  it("accepts real PNG magic bytes only for PNG mime", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(mediaBytesMatchMime(png, "image/png")).toBe(true);
    expect(mediaBytesMatchMime(png, "image/jpeg")).toBe(false);
  });
});
