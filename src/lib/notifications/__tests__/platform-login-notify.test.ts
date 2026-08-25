import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabase: () => null,
}));
vi.mock("@/lib/email/platform-invite", () => ({
  sendPlatformLoginAlertEmail: vi.fn(),
}));
vi.mock("@/lib/notifications/platform-team-whatsapp", () => ({
  notifyTeamLoginAlert: vi.fn(),
}));
vi.mock("@/lib/notifications/whatsapp-log", () => ({
  insertWhatsAppNotificationLog: vi.fn(async () => "log-id"),
}));

import {
  PLATFORM_LOGIN_ALERT_THROTTLE_MS,
  platformLoginAlertIdempotencyKey,
} from "@/lib/notifications/platform-login-notify";

describe("platform login alert throttle keys", () => {
  it("uses a stable 15-minute bucket so the first claim is never permanent", () => {
    expect(PLATFORM_LOGIN_ALERT_THROTTLE_MS).toBe(15 * 60_000);

    const userKey = "user-abc";
    // Align to the start of a throttle bucket so sameWindow stays inside it.
    const t0 =
      Math.floor(1_700_000_000_000 / PLATFORM_LOGIN_ALERT_THROTTLE_MS) *
      PLATFORM_LOGIN_ALERT_THROTTLE_MS;
    const sameWindow = t0 + PLATFORM_LOGIN_ALERT_THROTTLE_MS - 1;
    const nextWindow = t0 + PLATFORM_LOGIN_ALERT_THROTTLE_MS;

    const keyA = platformLoginAlertIdempotencyKey(userKey, t0);
    const keyB = platformLoginAlertIdempotencyKey(userKey, sameWindow);
    const keyC = platformLoginAlertIdempotencyKey(userKey, nextWindow);

    expect(keyA).toBe(keyB);
    expect(keyC).not.toBe(keyA);
    expect(keyA).toMatch(/^platform_login:user-abc:\d+$/);
  });
});