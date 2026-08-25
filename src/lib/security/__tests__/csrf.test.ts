import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  assertSameOrigin,
  forbiddenOriginResponse,
} from "@/lib/security/csrf";

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://www.truegoshengh.com/api/admin/login", {
    method: "POST",
    headers,
  });
}

describe("CSRF — same-origin checks", () => {
  it("allows matching Origin and Host", () => {
    expect(
      assertSameOrigin(
        requestWith({
          origin: "https://www.truegoshengh.com",
          host: "www.truegoshengh.com",
        })
      )
    ).toBe(true);
  });

  it("rejects cross-site Origin", () => {
    expect(
      assertSameOrigin(
        requestWith({
          origin: "https://evil.example",
          host: "www.truegoshengh.com",
        })
      )
    ).toBe(false);
  });

  it("rejects malformed Origin", () => {
    expect(
      assertSameOrigin(
        requestWith({
          origin: "not-a-url",
          host: "www.truegoshengh.com",
        })
      )
    ).toBe(false);
  });

  it("rejects missing Origin when sec-fetch-site is cross-site", () => {
    expect(
      assertSameOrigin(
        requestWith({
          host: "www.truegoshengh.com",
          "sec-fetch-site": "cross-site",
        })
      )
    ).toBe(false);
  });

  it("allows missing Origin for non-browser / same-site clients", () => {
    expect(
      assertSameOrigin(requestWith({ host: "www.truegoshengh.com" }))
    ).toBe(true);
    expect(
      assertSameOrigin(
        requestWith({
          host: "www.truegoshengh.com",
          "sec-fetch-site": "same-origin",
        })
      )
    ).toBe(true);
  });

  it("returns 403 from forbiddenOriginResponse", async () => {
    const res = forbiddenOriginResponse();
    expect(res.status).toBe(403);
    const body = (await res.json()) as { ok: boolean; message: string };
    expect(body.ok).toBe(false);
    expect(body.message).toMatch(/could not be verified/i);
  });
});
