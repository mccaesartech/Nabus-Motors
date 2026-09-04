import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const sendEmail = vi.fn();
const sendArkeselSms = vi.fn();
const logAppError = vi.fn();
const getSiteSettings = vi.fn(async () => ({ email: null, phone: null }));
const getPublicSiteUrl = vi.fn(() => "https://www.nabusmotors.com");

const notificationSelect = vi.fn();
const notificationInsert = vi.fn();
const profileSelect = vi.fn();
const getUserById = vi.fn();

vi.mock("@/lib/email/resend", () => ({
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));

vi.mock("@/lib/notifications/arkesel", () => ({
  sendArkeselSms: (...args: unknown[]) => sendArkeselSms(...args),
}));

vi.mock("@/lib/errors/logger", () => ({
  logAppError: (...args: unknown[]) => logAppError(...args),
}));

vi.mock("@/lib/platform/site-settings-server", () => ({
  getSiteSettings: () => getSiteSettings(),
}));

vi.mock("@/lib/site-url", () => ({
  getPublicSiteUrl: () => getPublicSiteUrl(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabase: () => ({
    from: (table: string) => {
      if (table === "notification_log") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      limit: () => ({
                        maybeSingle: notificationSelect,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
          insert: notificationInsert,
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: profileSelect,
          }),
        }),
      };
    },
    auth: {
      admin: {
        getUserById,
      },
    },
  }),
}));

import {
  ACCOUNT_WELCOME_TEMPLATE,
  NEVER_WELCOMED_CATCHUP_WINDOW_MS,
  NEW_ACCOUNT_WELCOME_WINDOW_MS,
  maybeSendCustomerWelcomeEmail,
} from "@/lib/customer/welcome-email";

describe("maybeSendCustomerWelcomeEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationSelect.mockResolvedValue({ data: null, error: null });
    notificationInsert.mockResolvedValue({ error: null });
    profileSelect.mockResolvedValue({ data: { phone: null, created_at: new Date().toISOString() }, error: null });
    getUserById.mockResolvedValue({
      data: { user: { created_at: new Date().toISOString() } },
      error: null,
    });
    sendEmail.mockResolvedValue({ messageId: "re_test" });
    sendArkeselSms.mockResolvedValue({ sent: true, provider: "arkesel", channel: "sms", messageId: "sms_1" });
  });

  it("exports a multi-day welcome window (covers delayed email confirm)", () => {
    expect(NEW_ACCOUNT_WELCOME_WINDOW_MS).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000);
    expect(NEVER_WELCOMED_CATCHUP_WINDOW_MS).toBeGreaterThan(NEW_ACCOUNT_WELCOME_WINDOW_MS);
    expect(ACCOUNT_WELCOME_TEMPLATE).toBe("account_welcome");
  });

  it("sends email for a new account and skips SMS when phone is missing", async () => {
    const result = await maybeSendCustomerWelcomeEmail({
      userId: "user-1",
      email: "ama@example.com",
      name: "Ama",
      registrationId: "TG-2026-00001",
      knownNewAccount: true,
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendArkeselSms).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      sent: true,
      emailSent: true,
      smsSent: false,
      reason: "email_sent_sms_skipped_no_phone",
      resendId: "re_test",
    });
    expect(logAppError).not.toHaveBeenCalled();
  });

  it("sends SMS when phone is provided without failing email", async () => {
    const result = await maybeSendCustomerWelcomeEmail({
      userId: "user-2",
      email: "ama@example.com",
      phone: "+233244000000",
      knownNewAccount: true,
    });

    expect(result.emailSent).toBe(true);
    expect(result.smsSent).toBe(true);
    expect(sendArkeselSms).toHaveBeenCalledOnce();
  });

  it("reports Resend failures to logAppError and does not claim success", async () => {
    sendEmail.mockRejectedValueOnce(new Error("domain is not verified"));

    const result = await maybeSendCustomerWelcomeEmail({
      userId: "user-3",
      email: "ama@example.com",
      phone: "+233244000000",
      knownNewAccount: true,
    });

    expect(result).toEqual({
      sent: false,
      emailSent: false,
      smsSent: false,
      reason: "send_failed",
    });
    expect(sendArkeselSms).not.toHaveBeenCalled();
    expect(logAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "customer.welcome-email",
        kind: "external_service",
      })
    );
  });

  it("skips when welcome was already sent", async () => {
    notificationSelect.mockResolvedValueOnce({ data: { id: "n1" }, error: null });

    const result = await maybeSendCustomerWelcomeEmail({
      userId: "user-4",
      email: "ama@example.com",
      knownNewAccount: true,
    });

    expect(result.reason).toBe("already_sent");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends when account age cannot be determined (fail-open, idempotent)", async () => {
    getUserById.mockResolvedValueOnce({ data: { user: null }, error: { message: "not found" } });
    profileSelect.mockResolvedValueOnce({ data: null, error: null });

    const result = await maybeSendCustomerWelcomeEmail({
      userId: "user-5",
      email: "ama@example.com",
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(result.emailSent).toBe(true);
  });

  it("sends catch-up welcome when account is older than 7d but never welcomed", async () => {
    const olderThanSevenDays = new Date(
      Date.now() - NEW_ACCOUNT_WELCOME_WINDOW_MS - 60_000
    ).toISOString();
    getUserById.mockResolvedValueOnce({
      data: { user: { created_at: olderThanSevenDays } },
      error: null,
    });

    const result = await maybeSendCustomerWelcomeEmail({
      userId: "user-6",
      email: "ama@example.com",
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(result.emailSent).toBe(true);
  });

  it("skips only when account is older than the never-welcomed catch-up window", async () => {
    const ancient = new Date(
      Date.now() - NEVER_WELCOMED_CATCHUP_WINDOW_MS - 60_000
    ).toISOString();
    getUserById.mockResolvedValueOnce({
      data: { user: { created_at: ancient } },
      error: null,
    });

    const result = await maybeSendCustomerWelcomeEmail({
      userId: "user-7",
      email: "ama@example.com",
    });

    expect(result.reason).toBe("not_new_account");
    expect(sendEmail).not.toHaveBeenCalled();
  });
});