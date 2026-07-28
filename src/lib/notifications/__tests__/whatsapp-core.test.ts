import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildMetaTemplateComponents,
  buildMetaTemplatePayload,
  renderTemplateString,
  resolveMetaTemplateName,
} from "@/lib/notifications/whatsapp-meta-templates";
import { mapMetaWebhookStatus, verifyMetaWebhookSignature } from "@/lib/notifications/whatsapp-meta";
import {
  computeWhatsAppNextRetryAt,
  shouldMarkWhatsAppUndeliverable,
  whatsappRetryBackoffMinutes,
  WHATSAPP_MAX_RETRY_ATTEMPTS,
} from "@/lib/notifications/whatsapp-retry";
import { createHmac } from "node:crypto";
import {
  looksLikeMaskedSecret,
  maskSecretValue,
  stripMaskedSecretUpdates,
} from "@/lib/platform/settings-secrets";

describe("whatsapp meta templates", () => {
  it("renders mustache-lite placeholders", () => {
    expect(renderTemplateString("Hi {{ name }}, reset: {{url}}", { name: "Ada", url: "https://x" })).toBe(
      "Hi Ada, reset: https://x"
    );
  });

  it("resolves template names from settings with defaults", () => {
    expect(resolveMetaTemplateName("password_reset")).toBe("password_reset");
    expect(
      resolveMetaTemplateName("password_reset", {
        whatsapp_template_password_reset: "tg_password_reset",
      })
    ).toBe("tg_password_reset");
  });

  it("builds Meta template components", () => {
    const payload = buildMetaTemplatePayload({
      kind: "team_invite",
      bodyParameters: ["Ada", "Manager", "https://example.com/invite"],
      buttonUrlParameter: "https://example.com/invite",
      languageCode: "en_US",
    });
    expect(payload.name).toBe("team_invite");
    expect(payload.language.code).toBe("en_US");
    expect(buildMetaTemplateComponents({ bodyParameters: [] })).toBeUndefined();
    expect(payload.components?.[0]?.type).toBe("body");
    expect(payload.components?.[1]?.sub_type).toBe("url");
  });
});

describe("whatsapp webhook signature + status mapping", () => {
  it("verifies X-Hub-Signature-256", () => {
    const secret = "test-app-secret";
    const body = JSON.stringify({ object: "whatsapp_business_account" });
    const digest = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyMetaWebhookSignature(body, `sha256=${digest}`, secret)).toBe(true);
    expect(verifyMetaWebhookSignature(body, `sha256=${digest}dead`, secret)).toBe(false);
    expect(verifyMetaWebhookSignature(body, null, secret)).toBe(false);
  });

  it("maps Meta delivery statuses", () => {
    expect(mapMetaWebhookStatus("sent")).toBe("sent");
    expect(mapMetaWebhookStatus("delivered")).toBe("delivered");
    expect(mapMetaWebhookStatus("read")).toBe("read");
    expect(mapMetaWebhookStatus("failed")).toBe("failed");
    expect(mapMetaWebhookStatus("deleted")).toBe("undeliverable");
    expect(mapMetaWebhookStatus("unknown")).toBeNull();
  });
});

describe("whatsapp retry backoff", () => {
  it("uses exponential-ish schedule and caps attempts", () => {
    expect(whatsappRetryBackoffMinutes(0)).toBe(1);
    expect(whatsappRetryBackoffMinutes(1)).toBe(5);
    expect(whatsappRetryBackoffMinutes(4)).toBe(180);
    expect(whatsappRetryBackoffMinutes(99)).toBe(180);

    const from = new Date("2026-07-27T12:00:00.000Z");
    expect(computeWhatsAppNextRetryAt(0, from).toISOString()).toBe("2026-07-27T12:01:00.000Z");
    expect(shouldMarkWhatsAppUndeliverable(WHATSAPP_MAX_RETRY_ATTEMPTS - 1)).toBe(false);
    expect(shouldMarkWhatsAppUndeliverable(WHATSAPP_MAX_RETRY_ATTEMPTS)).toBe(true);
  });
});

describe("settings secret masking", () => {
  it("masks and strips masked secrets on update", () => {
    expect(maskSecretValue("abcdef1234")).toMatch(/••••••••1234$/);
    expect(looksLikeMaskedSecret("••••••••1234")).toBe(true);
    expect(
      stripMaskedSecretUpdates({
        whatsapp_api_access_token: "••••••••1234",
        whatsapp_phone_number_id: "123",
      })
    ).toEqual({ whatsapp_phone_number_id: "123" });
  });
});
