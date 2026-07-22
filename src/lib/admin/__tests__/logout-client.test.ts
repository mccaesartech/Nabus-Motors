import { describe, expect, it, vi } from "vitest";
import { requestPlatformLogout } from "@/lib/admin/logout-client";

function jsonResponse(
  body: Record<string, unknown>,
  options: { ok?: boolean } = {}
): Response {
  return {
    ok: options.ok ?? true,
    json: async () => body,
  } as Response;
}

describe("requestPlatformLogout", () => {
  it("posts to the shared logout endpoint without caching credentials", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ ok: true, redirect: "/admin" })
      );

    await expect(requestPlatformLogout(fetcher)).resolves.toBe("/admin");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("/api/admin/logout", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  });

  it("uses the canonical login route when the server omits a redirect", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));

    await expect(requestPlatformLogout(fetcher)).resolves.toBe("/admin");
  });

  it("keeps the user in place with a recoverable error when logout fails", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { ok: false, message: "Session service unavailable." },
          { ok: false }
        )
      );

    await expect(requestPlatformLogout(fetcher)).rejects.toThrow(
      "Session service unavailable."
    );
  });
});
