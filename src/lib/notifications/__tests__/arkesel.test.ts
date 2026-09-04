import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/platform/site-settings", () => ({
  getAdminSiteSettings: vi.fn(async () => ({
    arkesel_api_key: "",
    arkesel_sender_id: "",
    arkesel_base_url: "https://sms.arkesel.com",
    arkesel_enabled: "true",
  })),
  parseBoolean: (value: string | undefined, fallback = false) => {
    if (value === undefined || value === "") return fallback;
    return value === "true" || value === "1";
  },
}));

import {
  isArkeselConfigReady,
  isArkeselProviderEnv,
  readArkeselConfigFromEnv,
} from "@/lib/notifications/arkesel-config";
import {
  buildArkeselSmsPayload,
  sendArkeselSms,
  toArkeselPhone,
} from "@/lib/notifications/arkesel";

describe("arkesel config helpers", () => {
  const envKeys = [
    "ARKESEL_API_KEY",
    "ARKESEL_SENDER_ID",
    "ARKESEL_SENDER",
    "ARKESEL_BASE_URL",
    "ARKESEL_ENABLED",
    "SMS_PROVIDER",
    "NOTIFICATION_PROVIDER",
  ] as const;
  const previous: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of envKeys) {
      previous[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  it("detects ready config only with api key + sender + enabled", () => {
    expect(isArkeselConfigReady({ apiKey: "", senderId: "TG" })).toBe(false);
    expect(isArkeselConfigReady({ apiKey: "key", senderId: "" })).toBe(false);
    expect(
      isArkeselConfigReady({ apiKey: "key", senderId: "TG", enabled: false })
    ).toBe(false);
    expect(isArkeselConfigReady({ apiKey: "key", senderId: "TG" })).toBe(true);
  });

  it("detects provider env selection", () => {
    expect(isArkeselProviderEnv()).toBe(false);
    process.env.SMS_PROVIDER = "arkesel";
    expect(isArkeselProviderEnv()).toBe(true);
    delete process.env.SMS_PROVIDER;
    process.env.NOTIFICATION_PROVIDER = "arkesel";
    expect(isArkeselProviderEnv()).toBe(true);
  });

  it("reads env credentials", () => {
    process.env.ARKESEL_API_KEY = "secret-key";
    process.env.ARKESEL_SENDER_ID = "TrueGoshen";
    const cfg = readArkeselConfigFromEnv();
    expect(cfg.configured).toBe(true);
    expect(cfg.smsReady).toBe(true);
    expect(cfg.source).toBe("env");
    expect(cfg.baseUrl).toBe("https://sms.arkesel.com");
  });
});

describe("arkesel payload + send", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds Arkesel v2 payload shape", () => {
    expect(
      buildArkeselSmsPayload({
        sender: " TrueGoshen ",
        message: "Hello",
        recipients: ["233279940200", " ", "+233501234567"],
      })
    ).toEqual({
      sender: "TrueGoshen",
      message: "Hello",
      recipients: ["233279940200", "+233501234567"],
    });
  });

  it("normalizes Ghana phones for Arkesel", () => {
    expect(toArkeselPhone("0244876784")).toBe("233279940200");
    expect(toArkeselPhone("+233 27 994 0200")).toBe("233279940200");
  });

  it("posts to Arkesel with api-key header", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ status: "success", data: { id: "msg_1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendArkeselSms("0244876784", "Test SMS", {
      apiKey: "test-key",
      senderId: "TrueGoshen",
      baseUrl: "https://sms.arkesel.com",
      enabled: true,
      configured: true,
      smsReady: true,
      source: "env",
    });

    expect(result).toEqual({
      sent: true,
      provider: "arkesel",
      channel: "sms",
      messageId: "msg_1",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [url, init] = call;
    expect(url).toBe("https://sms.arkesel.com/api/v2/sms/send");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "api-key": "test-key",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      sender: "TrueGoshen",
      message: "Test SMS",
      recipients: ["233279940200"],
    });
  });

  it("reads the message id from the Arkesel v2 array response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            status: "success",
            data: [
              { recipient: "233279940200", id: "9b752841-7ee7-4d40-b4fe-768bfb1da4f0" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const result = await sendArkeselSms("0244876784", "Test SMS", {
      apiKey: "test-key",
      senderId: "TrueGoshen",
      baseUrl: "https://sms.arkesel.com",
      enabled: true,
      configured: true,
      smsReady: true,
      source: "env",
    });

    expect(result).toEqual({
      sent: true,
      provider: "arkesel",
      channel: "sms",
      messageId: "9b752841-7ee7-4d40-b4fe-768bfb1da4f0",
    });
  });

  it("does not report success without a message id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ status: "success", data: [{ recipient: "233279940200" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const result = await sendArkeselSms("0244876784", "Test SMS", {
      apiKey: "test-key",
      senderId: "TrueGoshen",
      baseUrl: "https://sms.arkesel.com",
      enabled: true,
      configured: true,
      smsReady: true,
      source: "env",
    });

    expect(result.sent).toBe(false);
    if (!result.sent) {
      expect(result.reason).toMatch(/message id/i);
    }
  });

  it("does not report success when Arkesel rejects the recipient", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            status: "success",
            data: [{ "invalid numbers": ["233279940200"] }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const result = await sendArkeselSms("0244876784", "Test SMS", {
      apiKey: "test-key",
      senderId: "TrueGoshen",
      baseUrl: "https://sms.arkesel.com",
      enabled: true,
      configured: true,
      smsReady: true,
      source: "env",
    });

    expect(result.sent).toBe(false);
    if (!result.sent) {
      expect(result.reason).toContain("233279940200");
      expect(result.reason).toMatch(/invalid number/i);
    }
  });

  it("explains an out-of-credit account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ message: "Insufficient balance" }), { status: 402 })
      )
    );

    const result = await sendArkeselSms("0244876784", "Test SMS", {
      apiKey: "test-key",
      senderId: "TrueGoshen",
      baseUrl: "https://sms.arkesel.com",
      enabled: true,
      configured: true,
      smsReady: true,
      source: "env",
    });

    expect(result.sent).toBe(false);
    if (!result.sent) {
      expect(result.reason).toMatch(/out of SMS credit/i);
    }
  });

  it("explains an inactive gateway / unapproved sender ID", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ message: "Inactive Gateway" }), { status: 403 })
      )
    );

    const result = await sendArkeselSms("0244876784", "Test SMS", {
      apiKey: "test-key",
      senderId: "TrueGoshen",
      baseUrl: "https://sms.arkesel.com",
      enabled: true,
      configured: true,
      smsReady: true,
      source: "env",
    });

    expect(result.sent).toBe(false);
    if (!result.sent) {
      expect(result.reason).toMatch(/sender ID is approved/i);
    }
  });

  it("returns failure on HTTP error without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 })
      )
    );

    const result = await sendArkeselSms("0244876784", "Test", {
      apiKey: "bad",
      senderId: "TrueGoshen",
      baseUrl: "https://sms.arkesel.com",
      enabled: true,
      configured: true,
      smsReady: true,
      source: "env",
    });

    expect(result.sent).toBe(false);
    if (!result.sent) {
      expect(result.reason).toContain("401");
    }
  });
});
