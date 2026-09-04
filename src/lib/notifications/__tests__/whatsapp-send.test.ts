import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/platform/site-settings", () => ({
  getAdminSiteSettings: vi.fn(async () => ({
    whatsapp_enabled: "true",
    notify_team_whatsapp_enabled: "true",
    whatsapp_api_provider: "",
    whatsapp_phone_number_id: "",
    whatsapp_api_access_token: "",
    whatsapp_business_account_id: "",
    whatsapp_default_country: "GH",
    twilio_account_sid: "",
    twilio_auth_token: "",
    twilio_whatsapp_from: "",
  })),
  parseBoolean: (value: string | undefined, fallback = false) => {
    if (value === undefined || value === "") return fallback;
    return value === "true" || value === "1";
  },
}));

vi.mock("@/lib/notifications/termii-config", () => ({
  getTermiiConfig: vi.fn(async () => ({
    whatsappReady: false,
    smsReady: false,
    apiKey: "",
    senderId: "",
    whatsappDevice: "",
    baseUrl: "",
    smsChannel: "dnd" as const,
  })),
}));

vi.mock("@/lib/notifications/whatsapp-log", () => ({
  findNotificationByIdempotencyKey: vi.fn(async () => null),
  insertWhatsAppNotificationLog: vi.fn(async () => "log-1"),
  markWhatsAppSendOutcome: vi.fn(async () => undefined),
}));

describe("whatsapp kill-switch and send path", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("blocks sends when WHATSAPP_ENABLED=false", async () => {
    vi.stubEnv("WHATSAPP_ENABLED", "false");
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "token");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123");
    vi.stubEnv("WHATSAPP_PROVIDER", "meta");

    const { sendWhatsAppMessage } = await import("@/lib/notifications/whatsapp-send");
    const result = await sendWhatsAppMessage("+233279940200", "hello");
    expect(result.sent).toBe(false);
    if (!result.sent) {
      expect(result.reason).toMatch(/disabled/i);
    }
  });

  it("dedupes by idempotency key when already sent", async () => {
    vi.stubEnv("WHATSAPP_ENABLED", "true");
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "token");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123");
    vi.stubEnv("WHATSAPP_PROVIDER", "meta");

    const log = await import("@/lib/notifications/whatsapp-log");
    vi.mocked(log.findNotificationByIdempotencyKey).mockResolvedValueOnce({
      id: "existing",
      source_table: null,
      source_id: null,
      template: "test",
      channel: "whatsapp",
      status: "sent",
      recipient: "+233279940200",
      detail: null,
      provider: "meta",
      provider_message_id: "wamid.ABC",
      idempotency_key: "dedupe-1",
      retry_count: 0,
      next_retry_at: null,
      error_code: null,
    });

    const { sendWhatsAppMessage } = await import("@/lib/notifications/whatsapp-send");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await sendWhatsAppMessage("+233279940200", "hello", {
      idempotencyKey: "dedupe-1",
      persistLog: true,
      template: "test",
    });

    expect(result.sent).toBe(true);
    if (result.sent) {
      expect(result.deduped).toBe(true);
      expect(result.messageId).toBe("wamid.ABC");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends Meta text via fetch when configured", async () => {
    vi.stubEnv("WHATSAPP_ENABLED", "true");
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "token");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "pnid");
    vi.stubEnv("WHATSAPP_PROVIDER", "meta");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 })
    );

    const { sendWhatsAppMessage } = await import("@/lib/notifications/whatsapp-send");
    const result = await sendWhatsAppMessage("+233279940200", "hello world", {
      persistLog: false,
    });

    expect(result.sent).toBe(true);
    if (result.sent) {
      expect(result.provider).toBe("meta");
      expect(result.messageId).toBe("wamid.1");
    }
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });
});
