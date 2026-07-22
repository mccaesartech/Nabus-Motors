import { describe, expect, it } from "vitest";
import {
  PLATFORM_INVITE_TTL_MS,
  computePlatformInviteExpiresAt,
  isPlatformInviteExpired,
} from "@/lib/platform/invite-ttl";

describe("platform invite TTL", () => {
  it("expires exactly 24 hours after creation", () => {
    const createdAt = Date.parse("2026-07-22T12:00:00.000Z");
    const expiresAt = computePlatformInviteExpiresAt(createdAt);

    expect(expiresAt).toBe("2026-07-23T12:00:00.000Z");
    expect(Date.parse(expiresAt) - createdAt).toBe(PLATFORM_INVITE_TTL_MS);
  });

  it("marks invites expired after the TTL window", () => {
    const expiresAt = "2026-07-23T12:00:00.000Z";

    expect(isPlatformInviteExpired(expiresAt, Date.parse("2026-07-23T11:59:59.999Z"))).toBe(
      false
    );
    expect(isPlatformInviteExpired(expiresAt, Date.parse("2026-07-23T12:00:00.001Z"))).toBe(true);
  });
});
