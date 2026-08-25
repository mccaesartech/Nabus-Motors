import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const notifyCustomer = vi.fn();

vi.mock("@/lib/notifications/customer-notify", () => ({
  notifyCustomer: (params: unknown) => notifyCustomer(params),
}));

const fromMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabase: () => ({ from: (table: string) => fromMock(table) }),
}));

import {
  maybeNotifyNewDeviceLogin,
  NEW_DEVICE_ALERT_RETRY_MS,
} from "@/lib/customer/security-notify";

function chain(result: { data?: unknown; count?: number | null; error?: unknown }) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  for (const method of [
    "select",
    "eq",
    "in",
    "gte",
    "order",
    "limit",
    "maybeSingle",
  ]) {
    api[method] = vi.fn(self);
  }
  api.maybeSingle = vi.fn(async () => result);
  (api as { then?: unknown }).then = (
    resolve: (v: unknown) => unknown,
    reject?: (e: unknown) => unknown
  ) => Promise.resolve(result).then(resolve, reject);
  return api;
}

describe("maybeNotifyNewDeviceLogin", () => {
  beforeEach(() => {
    notifyCustomer.mockReset();
    notifyCustomer.mockResolvedValue({
      emailSent: true,
      channels: ["email"],
    });
    fromMock.mockReset();
  });

  it("skips the first tracked session", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "customer_sessions") {
        return chain({ count: 1, data: null, error: null });
      }
      return chain({ data: null, error: null });
    });

    const sent = await maybeNotifyNewDeviceLogin({
      userId: "user-1",
      fingerprint: "fp-aaa",
      email: "a@example.com",
      isNewSession: true,
    });

    expect(sent).toBe(false);
    expect(notifyCustomer).not.toHaveBeenCalled();
  });

  it("sends when a second fingerprint appears and nothing was sent yet", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "customer_sessions") {
        return chain({ count: 2, data: null, error: null });
      }
      if (table === "notification_log") {
        return chain({ data: [], error: null });
      }
      if (table === "profiles") {
        return chain({
          data: {
            email: "a@example.com",
            phone: null,
            first_name: "Ada",
            last_name: "Lovelace",
          },
          error: null,
        });
      }
      return chain({ data: null, error: null });
    });

    const sent = await maybeNotifyNewDeviceLogin({
      userId: "user-1",
      fingerprint: "fp-bbb",
      email: "a@example.com",
      userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0",
      ip: "1.2.3.4",
      isNewSession: true,
    });

    expect(sent).toBe(true);
    expect(notifyCustomer).toHaveBeenCalledTimes(1);
    const firstCall = notifyCustomer.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstCall).toMatchObject({
      template: "login_new_device",
      sourceTable: "customer_sessions",
      sourceId: "user-1:fp-bbb",
      email: "a@example.com",
    });
  });

  it("does not resend when a prior attempt already sent", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "customer_sessions") {
        return chain({ count: 3, data: null, error: null });
      }
      if (table === "notification_log") {
        return chain({
          data: [{ id: "n1", status: "sent", created_at: new Date().toISOString() }],
          error: null,
        });
      }
      return chain({ data: null, error: null });
    });

    const sent = await maybeNotifyNewDeviceLogin({
      userId: "user-1",
      fingerprint: "fp-bbb",
      email: "a@example.com",
    });

    expect(sent).toBe(false);
    expect(notifyCustomer).not.toHaveBeenCalled();
  });

  it("backs off when a failed attempt is still within the retry window", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "customer_sessions") {
        return chain({ count: 2, data: null, error: null });
      }
      if (table === "notification_log") {
        return chain({
          data: [
            {
              id: "n1",
              status: "failed",
              created_at: new Date(Date.now() - 60_000).toISOString(),
            },
          ],
          error: null,
        });
      }
      return chain({ data: null, error: null });
    });

    const sent = await maybeNotifyNewDeviceLogin({
      userId: "user-1",
      fingerprint: "fp-bbb",
      email: "a@example.com",
    });

    expect(sent).toBe(false);
    expect(notifyCustomer).not.toHaveBeenCalled();
    expect(NEW_DEVICE_ALERT_RETRY_MS).toBe(15 * 60_000);
  });

  it("retries after the backoff window when prior status was failed", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "customer_sessions") {
        return chain({ count: 2, data: null, error: null });
      }
      if (table === "notification_log") {
        return chain({
          data: [
            {
              id: "n1",
              status: "failed",
              created_at: new Date(
                Date.now() - NEW_DEVICE_ALERT_RETRY_MS - 1_000
              ).toISOString(),
            },
          ],
          error: null,
        });
      }
      if (table === "profiles") {
        return chain({
          data: {
            email: "a@example.com",
            phone: null,
            first_name: "Ada",
            last_name: null,
          },
          error: null,
        });
      }
      return chain({ data: null, error: null });
    });

    const sent = await maybeNotifyNewDeviceLogin({
      userId: "user-1",
      fingerprint: "fp-bbb",
      email: "a@example.com",
    });

    expect(sent).toBe(true);
    expect(notifyCustomer).toHaveBeenCalledTimes(1);
  });
});